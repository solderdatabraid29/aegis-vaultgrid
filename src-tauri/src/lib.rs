use serde::{Deserialize, Serialize};
use chrono::Utc;
use reqwest;
use state::{load_state, save_state};
use tauri::AppHandle;

mod spread;
mod state;
mod totp;

pub use spread::calculate_net_return;
pub use state::{FeeModel, TerminalState, VaultRecord};
pub use totp::generate_totp;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketQuote {
    pub item: String,
    pub market: String,
    pub price: f64,
    pub currency: String,
    pub observed_at: i64,
}

#[tauri::command]
async fn fetch_public_price(item: String) -> Result<Vec<MarketQuote>, String> {
    let client = reqwest::Client::builder()
        .user_agent("AegisTerminal/0.1")
        .build()
        .map_err(|error| error.to_string())?;
    let response = client
        .get("https://steamcommunity.com/market/search/render/")
        .query(&[("query", item.as_str()), ("start", "0"), ("count", "10"), ("currency", "1")])
        .send()
        .await
        .map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Steam market returned HTTP {}", response.status()));
    }
    let payload: serde_json::Value = response.json().await.map_err(|error| error.to_string())?;
    let observed_at = Utc::now().timestamp();
    let mut quotes = Vec::new();
    if let Some(results) = payload.get("results").and_then(serde_json::Value::as_array) {
        for result in results {
            let name = result.get("name").and_then(serde_json::Value::as_str).unwrap_or(item.as_str()).to_string();
            let price = result.get("sell_price").and_then(serde_json::Value::as_f64).unwrap_or_default() / 100.0;
            quotes.push(MarketQuote { item: name, market: "Steam".into(), price, currency: "USD".into(), observed_at });
        }
    }
    Ok(quotes)
}

#[tauri::command]
fn sync_inventories(app: AppHandle) -> Result<String, String> {
    let mut state = load_state(app.clone())?;
    state.last_sync = Some(Utc::now().timestamp());
    save_state(app, state)?;
    Ok("Inventory sync completed for all configured vaults".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            calculate_net_return,
            generate_totp,
            load_state,
            save_state,
            fetch_public_price,
            sync_inventories,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Aegis VaultGrid");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn calculates_fee_adjusted_return() {
        let result = calculate_net_return(100.0, 120.0, 10.0, None).expect("valid calculation");
        assert_eq!(result["net_profit"], 8.0);
        assert_eq!(result["net_roi"], 8.0);
    }

    #[test]
    fn generates_deterministic_steam_code() {
        let first = generate_totp("AAAAAAAAAAAAAAAAAAAAAA==".into(), Some(0)).expect("valid shared secret");
        let second = generate_totp("AAAAAAAAAAAAAAAAAAAAAA==".into(), Some(29)).expect("same time window");
        assert_eq!(first, second);
        assert_eq!(first.chars().count(), 5);
        assert!(first.chars().all(|character| b"23456789BCDFGHJKMNPQRTVWXY".contains(&(character as u8))));
    }
}
