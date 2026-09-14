use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeeModel {
    pub venue: String,
    pub fee_percent: f64,
    pub settlement: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VaultRecord {
    pub alias: String,
    pub steam_id: String,
    pub shared_secret: Option<String>,
    pub inventory_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TerminalState {
    pub fee_models: Vec<FeeModel>,
    pub vaults: Vec<VaultRecord>,
    pub polling_ms: u64,
    #[serde(default)]
    pub last_sync: Option<i64>,
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let directory = app.path().app_data_dir().map_err(|error| error.to_string())?;
    fs::create_dir_all(&directory).map_err(|error| error.to_string())?;
    Ok(directory.join("aegis-vaultgrid-state.json"))
}

fn default_state() -> TerminalState {
    TerminalState {
        fee_models: vec![
            FeeModel { venue: "Steam".into(), fee_percent: 13.0, settlement: "USD".into() },
            FeeModel { venue: "Buff163".into(), fee_percent: 2.5, settlement: "CNY → USD".into() },
            FeeModel { venue: "CSFloat".into(), fee_percent: 2.0, settlement: "USD".into() },
            FeeModel { venue: "Skinport".into(), fee_percent: 12.0, settlement: "EUR → USD".into() },
            FeeModel { venue: "Waxpeer".into(), fee_percent: 6.0, settlement: "USD".into() },
        ],
        vaults: Vec::new(),
        polling_ms: 1000,
        last_sync: None,
    }
}

#[tauri::command]
pub fn load_state(app: AppHandle) -> Result<TerminalState, String> {
    let path = state_path(&app)?;
    match fs::read_to_string(path) {
        Ok(contents) => serde_json::from_str(&contents).map_err(|error| error.to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(default_state()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn save_state(app: AppHandle, state: TerminalState) -> Result<(), String> {
    let path = state_path(&app)?;
    let payload = serde_json::to_vec_pretty(&state).map_err(|error| error.to_string())?;
    fs::write(path, payload).map_err(|error| error.to_string())
}
