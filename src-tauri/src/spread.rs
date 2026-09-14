use serde_json::json;

#[tauri::command]
pub fn calculate_net_return(buy_price: f64, sell_price: f64, fee_percent: f64, cny_to_usd: Option<f64>) -> Result<serde_json::Value, String> {
    if buy_price < 0.0 || sell_price < 0.0 || !(0.0..=100.0).contains(&fee_percent) {
        return Err("Prices must be non-negative and fee must be between 0 and 100".into());
    }
    let conversion = cny_to_usd.unwrap_or(1.0);
    if conversion <= 0.0 {
        return Err("Currency conversion must be positive".into());
    }
    let normalized_buy = buy_price * conversion;
    let gross = sell_price - normalized_buy;
    let fee = sell_price * fee_percent / 100.0;
    let net = gross - fee;
    let roi = if normalized_buy == 0.0 { 0.0 } else { net / normalized_buy * 100.0 };
    Ok(json!({
        "normalized_buy": normalized_buy,
        "gross_profit": gross,
        "fee": fee,
        "net_profit": net,
        "net_roi": roi,
    }))
}
