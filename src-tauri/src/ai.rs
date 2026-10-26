//! Client for the user's own model endpoint (vLLM, Ollama, LM Studio, llama.cpp…), all of
//! which serve `GET /models` and `POST /chat/completions`. Mirrors `listModels` in backend.ts.

use crate::model::ChatMessage;
use anyhow::{anyhow, Context, Result};
use serde_json::{json, Value};
use std::time::Duration;

fn client(timeout: u64) -> Result<reqwest::Client> {
    Ok(reqwest::Client::builder().timeout(Duration::from_secs(timeout)).build()?)
}

fn auth(req: reqwest::RequestBuilder, key: Option<&str>) -> reqwest::RequestBuilder {
    match key.filter(|k| !k.is_empty()) {
        Some(k) => req.bearer_auth(k),
        None => req,
    }
}

pub async fn models(base_url: &str, key: Option<&str>) -> Result<Vec<String>> {
    let base = base_url.trim_end_matches('/');
    let c = client(15)?;
    match auth(c.get(format!("{base}/models")), key).send().await {
        Ok(res) if res.status().is_success() => {
            let body: Value = res.json().await.context("Endpoint did not return JSON")?;
            let list = body.get("data").or_else(|| body.get("models")).and_then(Value::as_array);
            let ids = names(list, &["id", "name"]);
            if !ids.is_empty() {
                return Ok(ids);
            }
        }
        // 401/403 etc. are real answers; only a missing route falls through to Ollama's API
        Ok(res) if res.status().as_u16() != 404 => return Err(anyhow!("Endpoint answered {}", res.status().as_u16())),
        _ => {}
    }
    let mut tags = reqwest::Url::parse(base).context("Invalid endpoint URL")?;
    tags.set_path("/api/tags");
    let body: Value = auth(c.get(tags), key)
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach the endpoint: {e}"))?
        .error_for_status()?
        .json()
        .await?;
    Ok(names(body["models"].as_array(), &["name"]))
}

fn names(list: Option<&Vec<Value>>, keys: &[&str]) -> Vec<String> {
    let mut out: Vec<String> = list
        .into_iter()
        .flatten()
        .filter_map(|m| keys.iter().find_map(|k| m.get(*k).and_then(Value::as_str)).map(String::from))
        .collect();
    out.sort();
    out
}

pub async fn chat(base_url: &str, key: Option<&str>, model: &str, messages: &[ChatMessage]) -> Result<String> {
    let base = base_url.trim_end_matches('/');
    let res = auth(client(120)?.post(format!("{base}/chat/completions")), key)
        .json(&json!({ "model": model, "messages": messages, "temperature": 0 }))
        .send()
        .await
        .map_err(|e| anyhow!("Could not reach the model endpoint: {e}"))?;
    if !res.status().is_success() {
        return Err(anyhow!("Model endpoint answered {}", res.status().as_u16()));
    }
    let body: Value = res.json().await?;
    body["choices"][0]["message"]["content"]
        .as_str()
        .map(String::from)
        .ok_or_else(|| anyhow!("Unexpected reply from the model endpoint"))
}
