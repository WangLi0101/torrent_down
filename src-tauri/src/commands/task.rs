use crate::engine::Engine;
use crate::error::CmdResult;
use crate::models::{TaskDetail, TaskSummary};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn add_task(
    engine: State<'_, Arc<Engine>>,
    magnet: String,
) -> CmdResult<serde_json::Value> {
    let task_id = engine.add_task(magnet).await?;
    Ok(serde_json::json!({ "taskId": task_id }))
}

#[tauri::command]
pub async fn confirm_task(
    engine: State<'_, Arc<Engine>>,
    task_id: usize,
    only_files: Vec<usize>,
    output_dir: String,
) -> CmdResult<()> {
    engine.confirm_task(task_id, only_files, output_dir).await
}

#[tauri::command]
pub fn list_tasks(engine: State<'_, Arc<Engine>>) -> CmdResult<Vec<TaskSummary>> {
    engine.list_tasks()
}

#[tauri::command]
pub fn get_task_detail(engine: State<'_, Arc<Engine>>, task_id: usize) -> CmdResult<TaskDetail> {
    engine.task_detail(task_id)
}

#[tauri::command]
pub async fn pause_task(engine: State<'_, Arc<Engine>>, task_id: usize) -> CmdResult<()> {
    engine.pause_task(task_id).await
}

#[tauri::command]
pub async fn resume_task(engine: State<'_, Arc<Engine>>, task_id: usize) -> CmdResult<()> {
    engine.resume_task(task_id).await
}

#[tauri::command]
pub async fn remove_task(
    engine: State<'_, Arc<Engine>>,
    task_id: usize,
    delete_files: bool,
) -> CmdResult<()> {
    engine.remove_task(task_id, delete_files).await
}
