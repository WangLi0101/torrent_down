use crate::error::{ApiError, CmdResult};
use serde::Deserialize;
use tauri::{webview::NewWindowResponse, AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow};
use url::Url;

use super::magnet::parse_magnet_input;

// Share the exact same catalog with the frontend; callers can only open these sites.
const SITE_CATALOG: &str = include_str!("../../../src/data/search-sites.json");

#[derive(Deserialize)]
struct SearchSite {
    id: String,
    name: String,
    url: Url,
}

fn find_site(site_id: &str) -> CmdResult<SearchSite> {
    let sites: Vec<SearchSite> = serde_json::from_str(SITE_CATALOG).map_err(ApiError::internal)?;
    sites
        .into_iter()
        .find(|site| site.id == site_id)
        .ok_or_else(|| ApiError::invalid("未找到该搜索站点"))
}

fn report_error(app: &AppHandle, message: &str) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.emit_to("main", "search:error", message);
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

fn receive_magnet(app: &AppHandle, url: &Url) -> bool {
    if url.scheme() != "magnet" {
        return false;
    }
    match parse_magnet_input(url.as_str()) {
        Ok(info) => {
            if let Some(main) = app.get_webview_window("main") {
                if let Err(error) = main.emit_to("main", "search:magnet", info.magnet_uri) {
                    tracing::warn!(%error, "failed to deliver search magnet");
                }
                let _ = main.show();
                let _ = main.unminimize();
                let _ = main.set_focus();
            }
        }
        Err(error) => report_error(app, &error.message),
    }
    true
}

// Keep external pages outside the app origin and its native capabilities.
fn is_web_url(url: &Url) -> bool {
    matches!(url.scheme(), "https" | "http")
        && url.host_str().is_some_and(|host| {
            host != "localhost"
                && !host.ends_with(".localhost")
                && host != "127.0.0.1"
                && host != "[::1]"
        })
}

// Open ordinary target=_blank links in the same search window. Native handlers
// also cover script-created popups and magnet links without exposing IPC to sites.
const SEARCH_SCRIPT: &str = r#"
document.addEventListener('click', (event) => {
  const anchor = event.composedPath().find((node) => node instanceof HTMLAnchorElement);
  if (!anchor) return;
  if (anchor.protocol === 'magnet:') {
    event.preventDefault();
    event.stopImmediatePropagation();
    window.location.href = anchor.href;
  } else if (anchor.target && anchor.target !== '_self') {
    anchor.target = '_self';
  }
}, true);
document.addEventListener('keydown', (event) => {
  if (event.altKey && event.key === 'ArrowLeft') {
    event.preventDefault(); history.back();
  } else if (event.altKey && event.key === 'ArrowRight') {
    event.preventDefault(); history.forward();
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r') {
    event.preventDefault(); location.reload();
  }
});
"#;

// An async command avoids WebView2 deadlocks when creating a window from IPC.
#[tauri::command]
pub async fn open_search_site(
    app: AppHandle,
    window: WebviewWindow,
    site_id: String,
) -> CmdResult<()> {
    if window.label() != "main" {
        return Err(ApiError::invalid("请从主窗口打开搜索站点"));
    }
    let site = find_site(&site_id)?;
    let label = format!("magnet-search-{}", site.id);
    if let Some(existing) = app.get_webview_window(&label) {
        existing.show().map_err(ApiError::internal)?;
        existing.unminimize().map_err(ApiError::internal)?;
        existing.set_focus().map_err(ApiError::internal)?;
        return Ok(());
    }

    let navigation_app = app.clone();
    let popup_app = app.clone();
    WebviewWindow::builder(&app, &label, WebviewUrl::External(site.url))
        .title(format!("{} · 磁力搜索 · TorrNet Player", site.name))
        .inner_size(1100.0, 780.0)
        .min_inner_size(800.0, 600.0)
        .center()
        .initialization_script(SEARCH_SCRIPT)
        .on_navigation(move |url| {
            if receive_magnet(&navigation_app, url) {
                return false;
            }
            is_web_url(url)
        })
        .on_new_window(move |url, _features| {
            if !receive_magnet(&popup_app, &url) && is_web_url(&url) {
                let app = popup_app.clone();
                let label = label.clone();
                tauri::async_runtime::spawn(async move {
                    if let Some(window) = app.get_webview_window(&label) {
                        if let Err(error) = window.navigate(url) {
                            report_error(&app, &format!("打开网页失败：{error}"));
                        }
                    }
                });
            }
            NewWindowResponse::Deny
        })
        .build()
        .map_err(ApiError::internal)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{find_site, is_web_url, SearchSite, SITE_CATALOG};
    use std::collections::HashSet;
    use url::Url;

    #[test]
    fn catalog_contains_unique_valid_sites_and_rejects_unknown_ids() {
        let sites: Vec<SearchSite> = serde_json::from_str(SITE_CATALOG).unwrap();
        let mut ids = HashSet::new();
        assert!(sites.len() >= 3);
        for site in sites {
            assert!(ids.insert(site.id.clone()));
            assert!(is_web_url(&site.url));
            assert_eq!(find_site(&site.id).unwrap().url, site.url);
        }
        assert!(find_site("https://example.com").is_err());
        assert!(find_site("missing").is_err());
    }

    #[test]
    fn external_navigation_cannot_load_app_or_local_origins() {
        for raw in [
            "tauri://localhost/index.html",
            "http://tauri.localhost/",
            "http://localhost:1420/",
            "http://127.0.0.1:1420/",
            "http://[::1]:1420/",
            "file:///etc/passwd",
            "javascript:alert(1)",
            "magnet:?xt=urn:btih:DD8255ECDC7CA55FB0BBF81323D87062DB1F6D1C",
        ] {
            assert!(!is_web_url(&Url::parse(raw).unwrap()), "{raw}");
        }
        assert!(is_web_url(
            &Url::parse("https://skrbtso.top/search").unwrap()
        ));
    }
}
