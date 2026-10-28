use crate::engine::Engine;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tauri::Emitter;

pub fn spawn_progress_loop(engine: Arc<Engine>) {
    tauri::async_runtime::spawn(async move {
        let mut previous = HashMap::new();
        let mut interval = tokio::time::interval(Duration::from_millis(500));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
        loop {
            interval.tick().await;
            let Ok(tasks) = engine.list_tasks() else {
                continue;
            };
            for task in tasks {
                let Ok(serialized) = serde_json::to_string(&task) else {
                    continue;
                };
                if previous.get(&task.id) == Some(&serialized) {
                    continue;
                }
                previous.insert(task.id, serialized);
                let _ = engine.app.emit("task:progress", task);
            }
        }
    });
}
