use crate::error::{ApiError, CmdResult};
use crate::models::MagnetInfo;
use librqbit::Magnet;
use url::Url;

pub fn parse_magnet_input(text: &str) -> CmdResult<MagnetInfo> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err(ApiError::invalid("请输入磁力链接或 info-hash"));
    }
    let extracted = if trimmed
        .get(.."magnet:?".len())
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("magnet:?"))
    {
        trimmed
    } else {
        let lower = trimmed.to_ascii_lowercase();
        lower
            .find("magnet:?")
            .map(|start| &trimmed[start..])
            .unwrap_or(trimmed)
    };
    let candidate = extracted
        .split(|character: char| {
            character.is_whitespace() || matches!(character, '"' | '\'' | '<' | '>')
        })
        .next()
        .unwrap_or_default()
        .trim_end_matches(|character| matches!(character, ',' | ';'));
    let magnet_uri = if candidate.len() == 40
        && candidate
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    {
        format!("magnet:?xt=urn:btih:{candidate}")
    } else if candidate.len() == 32
        && candidate
            .chars()
            .all(|character| character.is_ascii_alphanumeric())
    {
        format!("magnet:?xt=urn:btih:{}", candidate.to_ascii_uppercase())
    } else {
        candidate.to_string()
    };
    if !magnet_uri.to_ascii_lowercase().starts_with("magnet:?") {
        return Err(ApiError::new(
            "InvalidHash",
            "请输入有效的磁力链接、40 位 hex 或 32 位 base32 info-hash",
        ));
    }
    if !magnet_uri.to_ascii_lowercase().contains("xt=") {
        return Err(ApiError::new("MissingXt", "磁力链接缺少必需的 xt 字段"));
    }
    let magnet = Magnet::parse(&magnet_uri)
        .map_err(|error| ApiError::new("InvalidMagnet", format!("磁力链接解析失败：{error}")))?;
    let info_hash = magnet
        .as_id20()
        .ok_or_else(|| {
            ApiError::new(
                "InvalidHash",
                "仅支持包含有效 BitTorrent v1 info-hash 的链接",
            )
        })?
        .as_string();
    let url = Url::parse(&magnet_uri)
        .map_err(|error| ApiError::new("InvalidMagnet", error.to_string()))?;
    let length = url
        .query_pairs()
        .find(|(key, _)| key == "xl")
        .and_then(|(_, value)| value.parse::<u64>().ok());
    Ok(MagnetInfo {
        info_hash,
        name: magnet.name,
        trackers: magnet.trackers,
        length,
        magnet_uri,
    })
}

#[tauri::command]
pub fn parse_magnet(text: String) -> CmdResult<MagnetInfo> {
    parse_magnet_input(&text)
}

#[cfg(test)]
mod tests {
    use super::parse_magnet_input;

    #[test]
    fn parses_bare_hash_and_mixed_text() {
        let hash = "DD8255ECDC7CA55FB0BBF81323D87062DB1F6D1C";
        let bare = parse_magnet_input(hash).unwrap();
        assert_eq!(bare.info_hash, hash.to_ascii_lowercase());
        let mixed = parse_magnet_input(&format!(
            "download this: magnet:?xt=urn:btih:{hash}&dn=Demo&tr=udp%3A%2F%2Ftracker.test now"
        ))
        .unwrap();
        assert_eq!(mixed.name.as_deref(), Some("Demo"));
        assert_eq!(mixed.trackers, ["udp://tracker.test"]);
    }

    #[test]
    fn rejects_invalid_input() {
        assert!(parse_magnet_input("not a magnet").is_err());
        assert!(parse_magnet_input("magnet:?dn=missing").is_err());
        assert!(parse_magnet_input("电影名称🎬").is_err());
    }
}
