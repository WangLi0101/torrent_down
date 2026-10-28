mod commands;
mod engine;
mod error;
mod events;
mod models;
mod network;
mod store;

use engine::Engine;
use std::sync::Arc;
use store::Store;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "torrnet_player=info,librqbit=warn".into()),
        )
        .init();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&data_dir)?;
            let download_dir = app
                .path()
                .download_dir()
                .unwrap_or_else(|_| data_dir.join("Downloads"))
                .join("TorrNet");
            std::fs::create_dir_all(&download_dir)?;
            let store = Arc::new(Store::open(&data_dir.join("torrnet.db"))?);
            let engine = tauri::async_runtime::block_on(Engine::new(
                app.handle().clone(),
                store,
                download_dir,
                data_dir,
            ))?;
            app.manage(engine.clone());
            engine.restore_incomplete();
            events::spawn_progress_loop(engine);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::magnet::parse_magnet,
            commands::search::open_search_site,
            commands::task::add_task,
            commands::task::confirm_task,
            commands::task::list_tasks,
            commands::task::get_task_detail,
            commands::task::pause_task,
            commands::task::resume_task,
            commands::task::reconnect_task,
            commands::task::remove_task,
            commands::stream::get_stream_url,
            commands::settings::get_settings,
            commands::settings::set_settings,
            commands::settings::set_speed_limit,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TorrNet Player");
}
