//! SQLite in the app data folder (%APPDATA%\com.certy.app on Windows).
//! Items, services and settings are stored as JSON documents; secrets as sealed blobs.

use crate::model::{Item, Service, Snapshot};
use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use serde_json::Value;
use std::path::Path;

pub struct Db {
    conn: Connection,
}

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        let conn = Connection::open(path)?;
        Self::init(conn)
    }

    #[cfg(test)]
    pub fn memory() -> Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> Result<Self> {
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             CREATE TABLE IF NOT EXISTS services (id TEXT PRIMARY KEY, doc TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, doc TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK (id = 1), doc TEXT NOT NULL);
             CREATE TABLE IF NOT EXISTS secrets (
               item_id TEXT PRIMARY KEY, kind TEXT NOT NULL, file_name TEXT, sealed BLOB NOT NULL);
             CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, sealed BLOB NOT NULL);
             -- one row per reminder fired, so each threshold notifies once per expiry date
             CREATE TABLE IF NOT EXISTS notified (
               item_id TEXT NOT NULL, threshold INTEGER NOT NULL, expires_at TEXT NOT NULL,
               PRIMARY KEY (item_id, threshold, expires_at));
             CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);",
        )?;
        Ok(Self { conn })
    }

    pub fn snapshot(&self) -> Result<Snapshot> {
        Ok(Snapshot { services: self.services()?, items: self.items()?, settings: self.settings_raw()? })
    }

    fn docs<T: serde::de::DeserializeOwned>(&self, table: &str) -> Result<Vec<T>> {
        let mut stmt = self.conn.prepare(&format!("SELECT doc FROM {table}"))?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        let mut out = Vec::new();
        for doc in rows {
            // a row the current schema can't read is skipped rather than failing the whole app
            if let Ok(v) = serde_json::from_str(&doc?) {
                out.push(v);
            }
        }
        Ok(out)
    }

    pub fn services(&self) -> Result<Vec<Service>> {
        self.docs("services")
    }

    pub fn items(&self) -> Result<Vec<Item>> {
        self.docs("items")
    }

    pub fn item(&self, id: &str) -> Result<Option<Item>> {
        let doc: Option<String> =
            self.conn.query_row("SELECT doc FROM items WHERE id = ?1", [id], |r| r.get(0)).optional()?;
        Ok(doc.and_then(|d| serde_json::from_str(&d).ok()))
    }

    pub fn service(&self, id: &str) -> Result<Option<Service>> {
        let doc: Option<String> =
            self.conn.query_row("SELECT doc FROM services WHERE id = ?1", [id], |r| r.get(0)).optional()?;
        Ok(doc.and_then(|d| serde_json::from_str(&d).ok()))
    }

    pub fn put_item(&self, item: &Item) -> Result<()> {
        self.conn.execute(
            "INSERT INTO items (id, doc) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc",
            params![item.id, serde_json::to_string(item)?],
        )?;
        Ok(())
    }

    pub fn delete_item(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM items WHERE id = ?1", [id])?;
        self.conn.execute("DELETE FROM secrets WHERE item_id = ?1", [id])?;
        self.conn.execute("DELETE FROM notified WHERE item_id = ?1", [id])?;
        Ok(())
    }

    pub fn put_service(&self, service: &Service) -> Result<()> {
        self.conn.execute(
            "INSERT INTO services (id, doc) VALUES (?1, ?2) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc",
            params![service.id, serde_json::to_string(service)?],
        )?;
        Ok(())
    }

    pub fn delete_service(&self, id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM services WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn settings_raw(&self) -> Result<Option<Value>> {
        let doc: Option<String> =
            self.conn.query_row("SELECT doc FROM settings WHERE id = 1", [], |r| r.get(0)).optional()?;
        Ok(doc.and_then(|d| serde_json::from_str(&d).ok()))
    }

    pub fn put_settings(&self, settings: &Value) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (id, doc) VALUES (1, ?1) ON CONFLICT(id) DO UPDATE SET doc = excluded.doc",
            [serde_json::to_string(settings)?],
        )?;
        Ok(())
    }

    pub fn put_secret(&self, item_id: &str, kind: &str, file_name: Option<&str>, sealed: &[u8]) -> Result<()> {
        self.conn.execute(
            "INSERT INTO secrets (item_id, kind, file_name, sealed) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(item_id) DO UPDATE SET kind = excluded.kind, file_name = excluded.file_name, sealed = excluded.sealed",
            params![item_id, kind, file_name, sealed],
        )?;
        Ok(())
    }

    /// (kind, file name, sealed bytes)
    pub fn secret(&self, item_id: &str) -> Result<Option<(String, Option<String>, Vec<u8>)>> {
        Ok(self
            .conn
            .query_row("SELECT kind, file_name, sealed FROM secrets WHERE item_id = ?1", [item_id], |r| {
                Ok((r.get(0)?, r.get(1)?, r.get(2)?))
            })
            .optional()?)
    }

    pub fn put_kv(&self, key: &str, sealed: &[u8]) -> Result<()> {
        self.conn.execute(
            "INSERT INTO kv (key, sealed) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET sealed = excluded.sealed",
            params![key, sealed],
        )?;
        Ok(())
    }

    pub fn kv(&self, key: &str) -> Result<Option<Vec<u8>>> {
        Ok(self.conn.query_row("SELECT sealed FROM kv WHERE key = ?1", [key], |r| r.get(0)).optional()?)
    }

    pub fn delete_kv(&self, key: &str) -> Result<()> {
        self.conn.execute("DELETE FROM kv WHERE key = ?1", [key])?;
        Ok(())
    }

    /// Records a reminder; returns false if it had already fired.
    pub fn mark_notified(&self, item_id: &str, threshold: i64, expires_at: &str) -> Result<bool> {
        let n = self.conn.execute(
            "INSERT OR IGNORE INTO notified (item_id, threshold, expires_at) VALUES (?1, ?2, ?3)",
            params![item_id, threshold, expires_at],
        )?;
        Ok(n == 1)
    }

    pub fn meta(&self, key: &str) -> Result<Option<String>> {
        Ok(self.conn.query_row("SELECT value FROM meta WHERE key = ?1", [key], |r| r.get(0)).optional()?)
    }

    pub fn set_meta(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO meta (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reminders_fire_once_per_expiry() {
        let db = Db::memory().unwrap();
        assert!(db.mark_notified("i1", 7, "2030-01-01").unwrap());
        assert!(!db.mark_notified("i1", 7, "2030-01-01").unwrap());
        // renewed token: a new expiry date re-arms the same threshold
        assert!(db.mark_notified("i1", 7, "2031-01-01").unwrap());
    }

    #[test]
    fn unknown_fields_survive_a_round_trip() {
        let db = Db::memory().unwrap();
        let item: Item = serde_json::from_value(serde_json::json!({
            "id": "i1", "serviceId": "gitlab", "name": "CI", "kind": "token",
            "expiresAt": null, "source": "manual", "hasSecret": true,
            "createdAt": "2026-01-01T00:00:00Z", "subject": "CN=x"
        }))
        .unwrap();
        db.put_item(&item).unwrap();
        let back = serde_json::to_value(db.item("i1").unwrap().unwrap()).unwrap();
        assert_eq!(back["subject"], "CN=x");
        assert_eq!(back["createdAt"], "2026-01-01T00:00:00Z");
    }
}
