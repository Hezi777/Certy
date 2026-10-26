//! Tauri commands called by `src/lib/tauriBackend.ts`, plus the check logic the scheduler shares.

use crate::crypto::Vault;
use crate::db::Db;
use crate::model::*;
use crate::{ai, certs, checks};
use anyhow::{anyhow, Result};
use serde_json::Value;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, State};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_notification::NotificationExt;

pub struct AppState {
    pub db: Mutex<Db>,
    pub vault: Vault,
}

/// Commands return plain strings as errors; the UI shows them in a toast.
type Res<T> = std::result::Result<T, String>;

fn err(e: anyhow::Error) -> String {
    e.to_string()
}

const AI_KEY: &str = "ai_key";

#[tauri::command]
pub fn load(state: State<AppState>) -> Res<Snapshot> {
    state.db.lock().unwrap().snapshot().map_err(err)
}

#[tauri::command]
pub fn save_item(state: State<AppState>, item: Item, secret: Option<Secret>) -> Res<()> {
    let db = state.db.lock().unwrap();
    if let Some(secret) = secret {
        let (kind, name, bytes) = match secret {
            Secret::Token { token } => ("token", None, token.into_bytes()),
            Secret::File { file } => ("file", Some(file.name), file.bytes),
        };
        let sealed = state.vault.seal(&bytes).map_err(err)?;
        db.put_secret(&item.id, kind, name.as_deref(), &sealed).map_err(err)?;
    }
    db.put_item(&item).map_err(err)
}

#[tauri::command]
pub fn delete_item(state: State<AppState>, id: String) -> Res<()> {
    state.db.lock().unwrap().delete_item(&id).map_err(err)
}

#[tauri::command]
pub fn save_service(state: State<AppState>, service: Service) -> Res<()> {
    state.db.lock().unwrap().put_service(&service).map_err(err)
}

#[tauri::command]
pub fn delete_service(state: State<AppState>, id: String) -> Res<()> {
    state.db.lock().unwrap().delete_service(&id).map_err(err)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, state: State<AppState>, settings: Value) -> Res<()> {
    if let Ok(parsed) = serde_json::from_value::<Settings>(settings.clone()) {
        let launcher = app.autolaunch();
        // best effort: a locked-down machine may refuse, which must not block saving
        let _ = if parsed.autostart { launcher.enable() } else { launcher.disable() };
    }
    state.db.lock().unwrap().put_settings(&settings).map_err(err)
}

#[tauri::command]
pub async fn check_item(app: AppHandle, id: String) -> Res<CheckOutcome> {
    run_check(&app, &id).await.map_err(err)
}

#[tauri::command]
pub fn parse_cert(bytes: Vec<u8>, password: Option<String>) -> Res<CertInfo> {
    certs::parse(&bytes, password.as_deref()).map_err(err)
}

#[tauri::command]
pub fn reveal_secret(state: State<AppState>, id: String) -> Res<String> {
    let (_, _, sealed) = state.db.lock().unwrap().secret(&id).map_err(err)?.ok_or("No secret stored")?;
    let plain = state.vault.open_sealed(&sealed).map_err(err)?;
    String::from_utf8(plain).map_err(|_| "This secret is a file; export it instead".into())
}

#[tauri::command]
pub async fn export_file(app: AppHandle, id: String) -> Res<()> {
    let state = app.state::<AppState>();
    let (kind, name, sealed) = state.db.lock().unwrap().secret(&id).map_err(err)?.ok_or("No file stored")?;
    let bytes = state.vault.open_sealed(&sealed).map_err(err)?;
    let default_name = name.unwrap_or_else(|| if kind == "token" { "token.txt".into() } else { "certificate".into() });
    let Some(path) = app.dialog().file().set_file_name(&default_name).blocking_save_file() else {
        return Ok(()); // cancelled
    };
    let path = path.into_path().map_err(|e| e.to_string())?;
    std::fs::write(path, bytes).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_ai_key(state: State<AppState>, key: String) -> Res<()> {
    let db = state.db.lock().unwrap();
    if key.is_empty() {
        return db.delete_kv(AI_KEY).map_err(err);
    }
    db.put_kv(AI_KEY, &state.vault.seal(key.as_bytes()).map_err(err)?).map_err(err)
}

fn stored_ai_key(state: &AppState) -> Option<String> {
    let sealed = state.db.lock().unwrap().kv(AI_KEY).ok()??;
    String::from_utf8(state.vault.open_sealed(&sealed).ok()?).ok()
}

#[tauri::command]
pub async fn ai_models(app: AppHandle, base_url: String, key: Option<String>) -> Res<Vec<String>> {
    let key = key.or_else(|| stored_ai_key(&app.state::<AppState>()));
    ai::models(&base_url, key.as_deref()).await.map_err(err)
}

#[tauri::command]
pub async fn ai_chat(app: AppHandle, messages: Vec<ChatMessage>) -> Res<String> {
    let state = app.state::<AppState>();
    let settings = current_settings(&state).ok_or("AI assist is not configured")?;
    if settings.ai.base_url.is_empty() || settings.ai.model.is_empty() {
        return Err("Choose an endpoint and a model in Settings first".into());
    }
    let key = stored_ai_key(&state);
    ai::chat(&settings.ai.base_url, key.as_deref(), &settings.ai.model, &messages).await.map_err(err)
}

#[tauri::command]
pub fn test_notification(app: AppHandle) -> Res<()> {
    notify(&app, "Certy", "Notifications work. You'll hear from me before anything expires.");
    Ok(())
}

/* ------------------------------------------------------------------ shared */

pub fn current_settings(state: &AppState) -> Option<Settings> {
    let raw = state.db.lock().unwrap().settings_raw().ok()??;
    serde_json::from_value(raw).ok()
}

pub fn notify(app: &AppHandle, title: &str, body: &str) {
    if let Err(e) = app.notification().builder().title(title).body(body).show() {
        log::warn!("notification failed: {e}");
    }
}

/// Runs one item's live check and stores the result. Never holds the DB lock across a network call.
pub async fn run_check(app: &AppHandle, id: &str) -> Result<CheckOutcome> {
    let state = app.state::<AppState>();
    let (item, service, token) = {
        let db = state.db.lock().unwrap();
        let item = db.item(id)?.ok_or_else(|| anyhow!("Unknown item"))?;
        let service = db.service(&item.service_id)?.ok_or_else(|| anyhow!("Unknown service"))?;
        let token = match db.secret(id)? {
            Some((kind, _, sealed)) if kind == "token" => Some(String::from_utf8(state.vault.open_sealed(&sealed)?)?),
            _ => None,
        };
        (item, service, token)
    };

    let outcome = checks::run(&service, token.as_deref()).await?;

    let was_ok = item.last_check.as_ref().map(|c| c.ok).unwrap_or(true);
    let mut next = item.clone();
    next.last_check = Some(CheckResult { at: outcome.at.clone(), ok: outcome.ok, message: outcome.message.clone() });
    if let Some(at) = &outcome.expires_at {
        next.expires_at = Some(at.clone());
        next.source = if matches!(service.check, CheckConfig::Tls) { "tls".into() } else { "api".into() };
    }
    state.db.lock().unwrap().put_item(&next)?;
    if was_ok && !outcome.ok {
        notify(app, &format!("{} · {}", service.name, item.name), &outcome.message);
    }
    let _ = app.emit("items-changed", ());
    Ok(outcome)
}
