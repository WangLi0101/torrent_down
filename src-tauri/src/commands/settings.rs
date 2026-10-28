use crate::engine::Engine;
use crate::error::CmdResult;
use crate::models::Settings;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_settings(engine: State<'_, Arc<Engine>>) -> CmdResult<Settings> {
    engine.get_settings()
}

#[tauri::command]
pub fn set_settings(engine: State<'_, Arc<Engine>>, settings: Settings) -> CmdResult<()> {
    engine.set_settings(settings)
}

#[tauri::command]
pub fn set_speed_limit(
    engine: State<'_, Arc<Engine>>,
    down: Option<u64>,
    up: Option<u64>,
) -> CmdResult<()> {
    engine.set_speed_limit(down, up)
}
