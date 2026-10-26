//! Secrets at rest: AES-256-GCM with a random key kept in the OS credential store
//! (Windows Credential Manager, macOS Keychain). The database alone is useless without it.

use aes_gcm::aead::{Aead, AeadCore, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, Key, Nonce};
use anyhow::{anyhow, Context, Result};
use base64::{engine::general_purpose::STANDARD, Engine};

const SERVICE: &str = "Certy";
const ACCOUNT: &str = "vault-key";
const NONCE_LEN: usize = 12;

pub struct Vault {
    cipher: Aes256Gcm,
}

impl Vault {
    /// Loads the key from the credential store, creating it on first run.
    pub fn open() -> Result<Self> {
        let entry = keyring::Entry::new(SERVICE, ACCOUNT).context("credential store unavailable")?;
        let key = match entry.get_password() {
            Ok(b64) => STANDARD.decode(b64).context("stored key is corrupt")?,
            Err(keyring::Error::NoEntry) => {
                let key = Aes256Gcm::generate_key(OsRng);
                entry
                    .set_password(&STANDARD.encode(key))
                    .context("could not save the encryption key")?;
                key.to_vec()
            }
            Err(e) => return Err(anyhow!("credential store error: {e}")),
        };
        if key.len() != 32 {
            return Err(anyhow!("stored key has the wrong length"));
        }
        Ok(Self { cipher: Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key)) })
    }

    #[cfg(test)]
    pub fn with_key(key: [u8; 32]) -> Self {
        Self { cipher: Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key)) }
    }

    /// nonce || ciphertext
    pub fn seal(&self, plain: &[u8]) -> Result<Vec<u8>> {
        let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
        let mut out = nonce.to_vec();
        out.extend(self.cipher.encrypt(&nonce, plain).map_err(|_| anyhow!("encryption failed"))?);
        Ok(out)
    }

    pub fn open_sealed(&self, sealed: &[u8]) -> Result<Vec<u8>> {
        if sealed.len() < NONCE_LEN {
            return Err(anyhow!("sealed data too short"));
        }
        let (nonce, data) = sealed.split_at(NONCE_LEN);
        self.cipher
            .decrypt(Nonce::from_slice(nonce), data)
            .map_err(|_| anyhow!("decryption failed: wrong key or tampered data"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let v = Vault::with_key([7; 32]);
        let sealed = v.seal(b"glpat-secret").unwrap();
        assert_ne!(&sealed[NONCE_LEN..], b"glpat-secret");
        assert_eq!(v.open_sealed(&sealed).unwrap(), b"glpat-secret");
    }

    #[test]
    fn wrong_key_fails() {
        let sealed = Vault::with_key([1; 32]).seal(b"x").unwrap();
        assert!(Vault::with_key([2; 32]).open_sealed(&sealed).is_err());
    }
}
