use crate::engine::Engine;
use crate::error::CmdResult;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub fn get_stream_url(
    engine: State<'_, Arc<Engine>>,
    task_id: usize,
    file_idx: usize,
) -> CmdResult<String> {
    engine.stream_url(task_id, file_idx)
}
