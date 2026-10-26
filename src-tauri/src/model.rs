//! Mirrors of the TypeScript types in `src/lib/types.ts`. Only the fields Rust reads are
//! typed; everything else rides along in `rest` so the UI can evolve without migrations.

use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Service {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub base_url: String,
    pub check: CheckConfig,
    #[serde(flatten)]
    pub rest: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum CheckConfig {
    None,
    Ping {
        method: String,
        path: String,
        headers: HashMap<String, String>,
        #[serde(rename = "okStatus")]
        ok_status: Vec<u16>,
    },
    Api {
        method: String,
        path: String,
        headers: HashMap<String, String>,
        pointer: String,
    },
    Tls,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub at: String,
    pub ok: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub id: String,
    pub service_id: String,
    pub name: String,
    pub kind: String,
    pub expires_at: Option<String>,
    pub source: String,
    #[serde(default)]
    pub has_secret: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub file_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reminders: Option<Vec<i64>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_check: Option<CheckResult>,
    #[serde(flatten)]
    pub rest: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiSettings {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub base_url: String,
    #[serde(default)]
    pub model: String,
    #[serde(flatten)]
    pub rest: Map<String, Value>,
}

fn yes() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    pub reminders: Vec<i64>,
    pub check_every_hours: u64,
    pub autostart: bool,
    /// Ask for Windows Hello / Windows sign-in before revealing or exporting a secret.
    #[serde(default = "yes")]
    pub require_sign_in: bool,
    pub ai: AiSettings,
    #[serde(flatten)]
    pub rest: Map<String, Value>,
}

/// A secret handed over with an item: a token string or a file's bytes.
#[derive(Debug, Deserialize)]
#[serde(untagged)]
pub enum Secret {
    Token { token: String },
    File { file: SecretFile },
}

#[derive(Debug, Deserialize)]
pub struct SecretFile {
    pub name: String,
    pub bytes: Vec<u8>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CertInfo {
    pub not_after: String,
    pub not_before: String,
    pub subject: String,
    pub issuer: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckOutcome {
    pub at: String,
    pub ok: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct Snapshot {
    pub services: Vec<Service>,
    pub items: Vec<Item>,
    pub settings: Option<Value>,
}
