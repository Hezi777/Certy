//! Live checks: HTTP ping, HTTP expiry lookup, and reading a server's TLS certificate.

use crate::model::{CheckConfig, CheckOutcome, Service};
use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use chrono::{DateTime, NaiveDate, Utc};
use reqwest::Method;
use rustls::client::danger::{HandshakeSignatureValid, ServerCertVerified, ServerCertVerifier};
use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
use rustls::{DigitallySignedStruct, SignatureScheme};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use x509_parser::prelude::{FromDer, X509Certificate};

const TIMEOUT: Duration = Duration::from_secs(15);

fn now() -> String {
    Utc::now().to_rfc3339()
}

/// `{{token}}` → the token; `{{basic:token}}` → base64(":token"), what Azure DevOps PATs expect.
pub fn fill(template: &str, token: &str) -> String {
    template
        .replace("{{basic:token}}", &STANDARD.encode(format!(":{token}")))
        .replace("{{token}}", token)
}

fn url(base: &str, path: &str) -> String {
    format!("{}/{}", base.trim_end_matches('/'), path.trim_start_matches('/'))
}

pub async fn run(service: &Service, token: Option<&str>) -> Result<CheckOutcome> {
    match &service.check {
        CheckConfig::None => Err(anyhow!("{} has no live check configured", service.name)),
        CheckConfig::Tls => {
            let (host, port) = host_port(&service.base_url)?;
            let expires = tls_expiry(&host, port).await?;
            Ok(CheckOutcome {
                at: now(),
                ok: true,
                message: format!("Certificate served by {host}"),
                expires_at: Some(expires),
            })
        }
        CheckConfig::Ping { method, path, headers, ok_status } => {
            let token = token.ok_or_else(|| anyhow!("No token stored for this item"))?;
            let status = request(&service.base_url, method, path, headers, token).await?.status().as_u16();
            let ok = ok_status.contains(&status);
            Ok(CheckOutcome {
                at: now(),
                ok,
                message: if ok {
                    format!("Token accepted ({status})")
                } else {
                    format!("Token rejected ({status}): revoked or expired")
                },
                expires_at: None,
            })
        }
        CheckConfig::Api { method, path, headers, pointer } => {
            let token = token.ok_or_else(|| anyhow!("No token stored for this item"))?;
            let res = request(&service.base_url, method, path, headers, token).await?;
            let status = res.status();
            if !status.is_success() {
                return Ok(CheckOutcome {
                    at: now(),
                    ok: false,
                    message: format!("Token rejected ({}): revoked or expired", status.as_u16()),
                    expires_at: None,
                });
            }
            let body: serde_json::Value = res.json().await.context("The service did not return JSON")?;
            let field = body.pointer(pointer);
            let expires_at = field.and_then(parse_date);
            let message = match (field, &expires_at) {
                (_, Some(_)) => "Token active, expiry read from the service".to_string(),
                (Some(serde_json::Value::Null), None) => "Token active and set to never expire".to_string(),
                _ => format!("Token active, but no date at {pointer}"),
            };
            Ok(CheckOutcome { at: now(), ok: true, message, expires_at })
        }
    }
}

async fn request(
    base: &str,
    method: &str,
    path: &str,
    headers: &HashMap<String, String>,
    token: &str,
) -> Result<reqwest::Response> {
    let client = reqwest::Client::builder().timeout(TIMEOUT).build()?;
    let method = Method::from_bytes(method.as_bytes()).unwrap_or(Method::GET);
    let mut req = client.request(method, url(base, path));
    for (k, v) in headers {
        req = req.header(k, fill(v, token));
    }
    req.send().await.map_err(|e| anyhow!("Could not reach {base}: {e}"))
}

/// Dates come back as RFC 3339, plain `YYYY-MM-DD`, or unix seconds/milliseconds.
pub fn parse_date(v: &serde_json::Value) -> Option<String> {
    match v {
        serde_json::Value::String(s) => DateTime::parse_from_rfc3339(s)
            .map(|d| d.with_timezone(&Utc))
            .ok()
            .or_else(|| {
                NaiveDate::parse_from_str(s, "%Y-%m-%d")
                    .ok()
                    .and_then(|d| d.and_hms_opt(0, 0, 0))
                    .map(|d| d.and_utc())
            })
            .map(|d| d.to_rfc3339()),
        serde_json::Value::Number(n) => {
            let n = n.as_i64()?;
            let secs = if n > 100_000_000_000 { n / 1000 } else { n };
            DateTime::<Utc>::from_timestamp(secs, 0).map(|d| d.to_rfc3339())
        }
        _ => None,
    }
}

fn host_port(base: &str) -> Result<(String, u16)> {
    let u = reqwest::Url::parse(if base.contains("://") { base.to_string() } else { format!("https://{base}") }.as_str())
        .context("Invalid base URL")?;
    let host = u.host_str().ok_or_else(|| anyhow!("Base URL has no host"))?.to_string();
    Ok((host, u.port().unwrap_or(443)))
}

/// Accepts any certificate: we are reading the expiry, not trusting the connection —
/// and an already-expired or internal-CA certificate is exactly what we must be able to see.
#[derive(Debug)]
struct ReadOnly(Arc<rustls::crypto::CryptoProvider>);

impl ServerCertVerifier for ReadOnly {
    fn verify_server_cert(
        &self,
        _: &CertificateDer<'_>,
        _: &[CertificateDer<'_>],
        _: &ServerName<'_>,
        _: &[u8],
        _: UnixTime,
    ) -> Result<ServerCertVerified, rustls::Error> {
        Ok(ServerCertVerified::assertion())
    }
    fn verify_tls12_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }
    fn verify_tls13_signature(
        &self,
        message: &[u8],
        cert: &CertificateDer<'_>,
        dss: &DigitallySignedStruct,
    ) -> Result<HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }
    fn supported_verify_schemes(&self) -> Vec<SignatureScheme> {
        self.0.signature_verification_algorithms.supported_schemes()
    }
}

pub async fn tls_expiry(host: &str, port: u16) -> Result<String> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let config = rustls::ClientConfig::builder_with_provider(provider.clone())
        .with_safe_default_protocol_versions()?
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(ReadOnly(provider)))
        .with_no_client_auth();
    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    let tcp = tokio::time::timeout(TIMEOUT, tokio::net::TcpStream::connect((host, port)))
        .await
        .map_err(|_| anyhow!("Timed out connecting to {host}:{port}"))??;
    let name = ServerName::try_from(host.to_string()).context("Invalid host name")?;
    let tls = tokio::time::timeout(TIMEOUT, connector.connect(name, tcp))
        .await
        .map_err(|_| anyhow!("TLS handshake with {host} timed out"))??;
    let (_, session) = tls.get_ref();
    let leaf = session
        .peer_certificates()
        .and_then(|c| c.first())
        .ok_or_else(|| anyhow!("{host} sent no certificate"))?;
    let (_, cert) = X509Certificate::from_der(leaf.as_ref()).map_err(|_| anyhow!("Unreadable certificate"))?;
    DateTime::<Utc>::from_timestamp(cert.validity().not_after.timestamp(), 0)
        .map(|d| d.to_rfc3339())
        .ok_or_else(|| anyhow!("Invalid certificate date"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn fills_templates() {
        assert_eq!(fill("Bearer {{token}}", "abc"), "Bearer abc");
        assert_eq!(fill("Basic {{basic:token}}", "abc"), format!("Basic {}", STANDARD.encode(":abc")));
    }

    #[test]
    fn parses_dates() {
        assert_eq!(parse_date(&json!("2030-01-01")).unwrap(), "2030-01-01T00:00:00+00:00");
        assert_eq!(parse_date(&json!("2030-01-01T12:00:00Z")).unwrap(), "2030-01-01T12:00:00+00:00");
        assert_eq!(parse_date(&json!(1893456000)).unwrap(), "2030-01-01T00:00:00+00:00");
        assert_eq!(parse_date(&json!(1893456000000i64)).unwrap(), "2030-01-01T00:00:00+00:00");
        assert!(parse_date(&json!(null)).is_none());
    }

    #[test]
    fn host_from_base_url() {
        assert_eq!(host_port("https://trino.corp:8443/ui").unwrap(), ("trino.corp".into(), 8443));
        assert_eq!(host_port("gitlab.com").unwrap(), ("gitlab.com".into(), 443));
    }
}
