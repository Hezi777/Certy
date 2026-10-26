//! Background loop: runs live checks every `checkEveryHours` and fires reminders as
//! thresholds are crossed. Runs while the window is hidden in the tray.

use crate::commands::{current_settings, notify, run_check, AppState};
use crate::model::{CheckConfig, Item};
use chrono::{DateTime, Utc};
use std::time::Duration;
use tauri::{AppHandle, Manager};

const TICK: Duration = Duration::from_secs(10 * 60);
const LAST_RUN: &str = "last_check_run";

pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // let the window and webview settle before the first network burst
        tokio::time::sleep(Duration::from_secs(5)).await;
        loop {
            if let Err(e) = tick(&app).await {
                log::warn!("scheduler tick failed: {e}");
            }
            tokio::time::sleep(TICK).await;
        }
    });
}

async fn tick(app: &AppHandle) -> anyhow::Result<()> {
    let state = app.state::<AppState>();
    let Some(settings) = current_settings(&state) else { return Ok(()) }; // not onboarded yet

    let due = {
        let db = state.db.lock().unwrap();
        let last = db.meta(LAST_RUN)?.and_then(|s| DateTime::parse_from_rfc3339(&s).ok());
        last.map_or(true, |t| Utc::now() - t.with_timezone(&Utc) >= chrono::Duration::hours(settings.check_every_hours as i64))
    };
    if due {
        let ids: Vec<String> = {
            let db = state.db.lock().unwrap();
            let services = db.services()?;
            db.items()?
                .into_iter()
                .filter(|i| {
                    services.iter().any(|s| {
                        s.id == i.service_id
                            && match s.check {
                                CheckConfig::None => false,
                                CheckConfig::Tls => true,
                                _ => i.has_secret && i.kind == "token",
                            }
                    })
                })
                .map(|i| i.id)
                .collect()
        };
        for id in ids {
            if let Err(e) = run_check(app, &id).await {
                log::info!("check {id} failed: {e}");
            }
        }
        state.db.lock().unwrap().set_meta(LAST_RUN, &Utc::now().to_rfc3339())?;
    }

    remind(app, &settings.reminders)
}

/// Whole days left, rounded up; negative once expired. Matches `daysLeft` in expiry.ts.
pub fn days_left(expires_at: &str, now: DateTime<Utc>) -> Option<i64> {
    let at = DateTime::parse_from_rfc3339(expires_at).ok()?.with_timezone(&Utc);
    Some(((at - now).num_seconds() as f64 / 86_400.0).ceil() as i64)
}

/// Smallest threshold already reached. Matches `dueThreshold` in expiry.ts.
pub fn due_threshold(days: i64, reminders: &[i64]) -> Option<i64> {
    let mut sorted = reminders.to_vec();
    sorted.sort_unstable();
    sorted.into_iter().find(|r| days <= *r)
}

fn remind(app: &AppHandle, defaults: &[i64]) -> anyhow::Result<()> {
    let state = app.state::<AppState>();
    let (items, services) = {
        let db = state.db.lock().unwrap();
        (db.items()?, db.services()?)
    };
    let now = Utc::now();
    for item in items {
        let Some(expires_at) = &item.expires_at else { continue };
        let Some(days) = days_left(expires_at, now) else { continue };
        let reminders = item.reminders.as_deref().unwrap_or(defaults);
        let Some(threshold) = due_threshold(days, reminders) else { continue };
        if !state.db.lock().unwrap().mark_notified(&item.id, threshold, expires_at)? {
            continue;
        }
        let service = services.iter().find(|s| s.id == item.service_id).map(|s| s.name.as_str()).unwrap_or("Certy");
        notify(app, &format!("{service} · {}", item.name), &body(&item, days));
    }
    Ok(())
}

fn body(item: &Item, days: i64) -> String {
    let what = if item.kind == "certificate" { "Certificate" } else { "Token" };
    let date = item
        .expires_at
        .as_deref()
        .and_then(|d| DateTime::parse_from_rfc3339(d).ok())
        .map(|d| d.format("%b %-d").to_string())
        .unwrap_or_default();
    match days {
        d if d < 0 => format!("{what} expired {} day{} ago.", -d, if d == -1 { "" } else { "s" }),
        0 => format!("{what} expires today."),
        1 => format!("{what} expires tomorrow ({date})."),
        d => format!("{what} expires in {d} days ({date})."),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_round_up() {
        let now = DateTime::parse_from_rfc3339("2026-01-01T12:00:00Z").unwrap().with_timezone(&Utc);
        assert_eq!(days_left("2026-01-02T00:00:00Z", now), Some(1));
        assert_eq!(days_left("2025-12-30T12:00:00Z", now), Some(-2));
    }

    #[test]
    fn thresholds() {
        assert_eq!(due_threshold(6, &[30, 14, 7, 1]), Some(7));
        assert_eq!(due_threshold(40, &[30, 14, 7, 1]), None);
        assert_eq!(due_threshold(-3, &[30, 7, 0]), Some(0));
    }
}
