use base64::{engine::general_purpose, Engine as _};
use chrono::Utc;
use hmac::{Hmac, Mac};
use sha1::Sha1;

type HmacSha1 = Hmac<Sha1>;

#[tauri::command]
pub fn generate_totp(secret: String, timestamp: Option<i64>) -> Result<String, String> {
    let normalized = secret.replace([' ', '-'], "").to_uppercase();
    let decoded = general_purpose::STANDARD
        .decode(&normalized)
        .or_else(|_| general_purpose::URL_SAFE_NO_PAD.decode(&normalized))
        .map_err(|error| format!("Invalid Steam Guard shared secret: {error}"))?;
    let unix_time = timestamp.unwrap_or_else(|| Utc::now().timestamp());
    if unix_time < 0 {
        return Err("Timestamp must be non-negative".into());
    }
    let counter = (unix_time / 30).to_be_bytes();
    let mut mac = HmacSha1::new_from_slice(&decoded).map_err(|error| error.to_string())?;
    mac.update(&counter);
    let digest = mac.finalize().into_bytes();
    let offset = (digest[19] & 0x0f) as usize;
    let binary = ((u32::from(digest[offset]) & 0x7f) << 24)
        | (u32::from(digest[offset + 1]) << 16)
        | (u32::from(digest[offset + 2]) << 8)
        | u32::from(digest[offset + 3]);
    const ALPHABET: &[u8] = b"23456789BCDFGHJKMNPQRTVWXY";
    let mut code = String::with_capacity(5);
    let mut value = binary;
    for _ in 0..5 {
        code.push(ALPHABET[(value % ALPHABET.len() as u32) as usize] as char);
        value /= ALPHABET.len() as u32;
    }
    Ok(code)
}
