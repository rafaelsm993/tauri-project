use super::commands::{self, LibraryFile, LibraryState};
use crate::api::http::{client as http, request_error};
use crate::store::file::write_atomic;
use std::collections::BTreeSet;
use std::future::Future;
use std::path::Path;
use std::time::{Duration, Instant};

const TIMEOUT: Duration = Duration::from_secs(15);

// A failed poster waits this long before the next save may retry it; a restart always retries.
pub const RETRY_AFTER: Duration = Duration::from_secs(10 * 60);

pub fn retry_due(last_failure: Option<Instant>, now: Instant) -> bool {
    last_failure.is_none_or(|t| now.duration_since(t) >= RETRY_AFTER)
}

// Hosts a poster may come from; tauri.conf.json img-src lists the same ones.
pub const HOSTS: [&str; 4] = [
    "image.tmdb.org",
    "s4.anilist.co",
    "media.rawg.io",
    ".mzstatic.com",
];

// Largest poster the cache accepts, in bytes.
pub const MAX_BYTES: usize = 1_000_000;

pub fn allowed(url: &str) -> bool {
    let Ok(u) = reqwest::Url::parse(url) else {
        return false;
    };
    let Some(host) = u.host_str() else {
        return false;
    };
    u.scheme() == "https"
        && HOSTS.iter().any(|h| {
            if h.starts_with('.') {
                host.ends_with(h)
            } else {
                host == *h
            }
        })
}

// Asks each CDN for a card-sized image so the cache stays small.
pub fn download_url(url: &str) -> String {
    if let Some((head, tail)) = url.split_once("/t/p/") {
        if let Some((_, rest)) = tail.split_once('/') {
            return format!("{head}/t/p/w342/{rest}");
        }
    }
    if let Some(rest) = url.strip_prefix("https://media.rawg.io/media/") {
        if !rest.starts_with("resize/") && !rest.starts_with("crop/") {
            return format!("https://media.rawg.io/media/resize/420/-/{rest}");
        }
    }
    if url.contains(".mzstatic.com/") {
        if let Some(u) = crate::api::itunes::upscale_cover(Some(url), 600) {
            return u;
        }
    }
    url.to_string()
}

// Extension from the file's magic bytes; None means "not an image we keep".
pub fn image_ext(bytes: &[u8]) -> Option<&'static str> {
    match bytes {
        [0xFF, 0xD8, 0xFF, ..] => Some("jpg"),
        [0x89, b'P', b'N', b'G', ..] => Some("png"),
        [b'R', b'I', b'F', b'F', _, _, _, _, b'W', b'E', b'B', b'P', ..] => Some("webp"),
        _ => None,
    }
}

// One file per entry; `tmdb:movie:1` becomes `tmdb_movie_1`.
pub fn file_stem(key: &str) -> String {
    key.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '_'
            }
        })
        .take(120)
        .collect()
}

pub fn orphans<'a>(present: &'a [String], referenced: &BTreeSet<String>) -> Vec<&'a String> {
    present
        .iter()
        .filter(|f| !referenced.contains(*f))
        .collect()
}

pub fn remove_quietly(path: &Path) {
    if let Err(e) = std::fs::remove_file(path) {
        if e.kind() != std::io::ErrorKind::NotFound {
            log::warn!("[posters] remove {}: {e}", path.display());
        }
    }
}

// Entries whose poster is not on disk yet, as (key, remote url).
pub fn missing(file: &LibraryFile, dir: &Path) -> Vec<(String, String)> {
    file.entries
        .values()
        .filter_map(|e| {
            let url = e.snapshot.poster_path.as_ref()?;
            let on_disk = e
                .snapshot
                .poster_file
                .as_ref()
                .is_some_and(|f| dir.join(f).is_file());
            (!on_disk).then(|| (e.key.clone(), url.clone()))
        })
        .collect()
}

pub async fn fetch_image(url: String) -> Result<Vec<u8>, String> {
    let resp = http()
        .get(&url)
        .timeout(TIMEOUT)
        .send()
        .await
        .map_err(|e| request_error("posters", e))?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status().as_u16()));
    }
    if resp.content_length().is_some_and(|n| n > MAX_BYTES as u64) {
        return Err("larger than the cache limit".into());
    }
    let bytes = resp
        .bytes()
        .await
        .map_err(|e| request_error("posters", e))?;
    if bytes.len() > MAX_BYTES {
        return Err("larger than the cache limit".into());
    }
    Ok(bytes.to_vec())
}

async fn cache_one<F, Fut>(dir: &Path, key: &str, url: &str, fetch: &F) -> Result<String, String>
where
    F: Fn(String) -> Fut,
    Fut: Future<Output = Result<Vec<u8>, String>>,
{
    if !allowed(url) {
        return Err("host is not on the poster allow-list".into());
    }
    let bytes = fetch(download_url(url)).await?;
    let ext = image_ext(&bytes).ok_or("not a jpg, png or webp image")?;
    std::fs::create_dir_all(dir).map_err(|e| format!("create {}: {e}", dir.display()))?;
    let name = format!("{}.{ext}", file_stem(key));
    write_atomic(&dir.join(&name), &bytes)?;
    Ok(name)
}

fn list_files(dir: &Path) -> Vec<String> {
    std::fs::read_dir(dir)
        .map(|rd| {
            rd.filter_map(Result::ok)
                .filter_map(|e| e.file_name().into_string().ok())
                .collect()
        })
        .unwrap_or_default()
}

// Downloads missing posters, attaches them, then deletes files no entry uses.
pub async fn fill_with<F, Fut>(state: LibraryState, fetch: F)
where
    F: Fn(String) -> Fut,
    Fut: Future<Output = Result<Vec<u8>, String>>,
{
    let _one_at_a_time = state.poster_lock.lock().await;
    let dir = state.posters.clone();
    let todo = state.store.read(|f| missing(f, &dir)).await;
    for (key, url) in todo {
        let last = state.poster_failures.lock().await.get(&key).copied();
        if !retry_due(last, Instant::now()) {
            continue;
        }
        match cache_one(&dir, &key, &url, &fetch).await {
            Ok(name) if !commands::attach_poster(&state, &key, &name).await => {
                remove_quietly(&dir.join(name));
            }
            Ok(_) => {
                state.poster_failures.lock().await.remove(&key);
                log::info!("[posters] cached {key}");
            }
            Err(e) => {
                state
                    .poster_failures
                    .lock()
                    .await
                    .insert(key.clone(), Instant::now());
                log::warn!("[posters] {key}: {e}");
            }
        }
    }
    let referenced = commands::poster_files(&state).await;
    let present = list_files(&dir);
    for name in orphans(&present, &referenced) {
        remove_quietly(&dir.join(name));
    }
}

pub async fn fill(state: LibraryState) {
    fill_with(state, fetch_image).await;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::types::{Id, MediaItem, MediaType, ProviderId};
    use crate::library::commands::{add, remove};
    use crate::library::types::UserData;
    use crate::store::file::tests::scratch;

    const PNG: &[u8] = &[0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];
    const REMOTE: &str = "https://image.tmdb.org/t/p/w500/a.jpg";

    async fn png(_: String) -> Result<Vec<u8>, String> {
        Ok(PNG.to_vec())
    }

    async fn offline(_: String) -> Result<Vec<u8>, String> {
        Err("offline".into())
    }

    async fn never(url: String) -> Result<Vec<u8>, String> {
        panic!("must not download {url}")
    }

    async fn saved_with_poster(name: &str, poster: &str) -> (std::path::PathBuf, LibraryState) {
        let dir = scratch(name);
        let state = LibraryState::new(&dir, LibraryFile::default());
        let item = MediaItem {
            poster_path: Some(poster.into()),
            ..MediaItem::new(Id::Num(7), "Arcane".into(), MediaType::Tv, ProviderId::Tmdb)
        };
        add(&state, &item, UserData::default(), "t1".into(), None)
            .await
            .unwrap();
        (dir, state)
    }

    fn poster_file(dir: &Path) -> Option<String> {
        let file: crate::store::file::Versioned<LibraryFile> =
            crate::store::file::read_with_recovery(&dir.join("library.json"))
                .unwrap()
                .unwrap();
        file.data.entries["tmdb:tv:7"].snapshot.poster_file.clone()
    }

    #[tokio::test]
    async fn fill_downloads_attaches_and_remove_cleans_up() {
        let (dir, state) = saved_with_poster("c6-fill", REMOTE).await;
        fill_with(state.clone(), png).await;
        assert_eq!(poster_file(&dir).as_deref(), Some("tmdb_tv_7.png"));
        assert!(state.posters.join("tmdb_tv_7.png").is_file());
        remove(&state, "tmdb:tv:7", None).await.unwrap();
        assert!(!state.posters.join("tmdb_tv_7.png").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_failed_download_keeps_the_entry_and_the_remote_url() {
        let (dir, state) = saved_with_poster("c6-offline", REMOTE).await;
        fill_with(state.clone(), offline).await;
        assert_eq!(poster_file(&dir), None);
        let entries = commands::load(&state).await;
        assert_eq!(entries[0].snapshot.poster_path.as_deref(), Some(REMOTE));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_failed_poster_is_not_retried_until_the_cooldown_passes() {
        let (dir, state) = saved_with_poster("c6-cooldown", REMOTE).await;
        let calls = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));
        let counting = |_: String| {
            let calls = calls.clone();
            async move {
                calls.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                Err::<Vec<u8>, String>("offline".into())
            }
        };
        fill_with(state.clone(), counting).await;
        fill_with(state.clone(), counting).await;
        assert_eq!(calls.load(std::sync::atomic::Ordering::SeqCst), 1);
        state.poster_failures.lock().await.clear();
        fill_with(state.clone(), png).await;
        assert_eq!(poster_file(&dir).as_deref(), Some("tmdb_tv_7.png"));
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn retry_waits_for_the_cooldown() {
        let t0 = std::time::Instant::now();
        assert!(retry_due(None, t0));
        assert!(!retry_due(Some(t0), t0 + RETRY_AFTER / 2));
        assert!(retry_due(Some(t0), t0 + RETRY_AFTER));
    }

    #[tokio::test]
    async fn a_host_outside_the_allow_list_is_never_fetched() {
        let (dir, state) = saved_with_poster("c6-host", "https://example.com/p.jpg").await;
        fill_with(state.clone(), never).await;
        assert_eq!(poster_file(&dir), None);
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_deleted_file_is_downloaded_again_and_strays_are_swept() {
        let (dir, state) = saved_with_poster("c6-heal", REMOTE).await;
        fill_with(state.clone(), png).await;
        std::fs::remove_file(state.posters.join("tmdb_tv_7.png")).unwrap();
        std::fs::write(state.posters.join("stray.jpg"), b"x").unwrap();
        fill_with(state.clone(), png).await;
        assert!(state.posters.join("tmdb_tv_7.png").is_file());
        assert!(!state.posters.join("stray.jpg").exists());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[tokio::test]
    async fn a_non_image_body_is_not_kept() {
        let (dir, state) = saved_with_poster("c6-html", REMOTE).await;
        fill_with(state.clone(), |_| async { Ok(b"<html>".to_vec()) }).await;
        assert_eq!(poster_file(&dir), None);
        assert!(list_files(&state.posters).is_empty());
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn config_allows_every_poster_host_and_scopes_the_asset_protocol() {
        let conf: serde_json::Value =
            serde_json::from_str(include_str!("../../tauri.conf.json")).unwrap();
        let security = &conf["app"]["security"];
        let img = security["csp"]["img-src"].as_str().expect("img-src is set");
        for host in HOSTS {
            assert!(
                img.contains(host.trim_start_matches('.')),
                "img-src misses {host}"
            );
        }
        assert!(img.contains("asset:") && img.contains("http://asset.localhost"));
        let csp = security["csp"].to_string();
        assert!(!csp.contains("fonts.g"), "fonts are bundled, not fetched");
        let dev = security["devCsp"]["connect-src"]
            .as_str()
            .expect("devCsp is set");
        assert!(dev.contains("ws://localhost:1421") && dev.contains("ws://127.0.0.1:1421"));
        assert_eq!(security["devCsp"]["img-src"], security["csp"]["img-src"]);
        assert_eq!(security["assetProtocol"]["enable"], true);
        assert_eq!(
            security["assetProtocol"]["scope"],
            serde_json::json!(["$APPDATA/posters/**"])
        );
    }

    #[tokio::test]
    #[ignore = "hits the network"]
    async fn live_tmdb_poster_downloads_under_the_cap() {
        let url = download_url("https://image.tmdb.org/t/p/w500/bjiS5ipwxb9JFy3XRRN4OAilSeX.jpg");
        let bytes = fetch_image(url).await.unwrap();
        assert_eq!(image_ext(&bytes), Some("jpg"));
        assert!(bytes.len() < MAX_BYTES);
    }

    #[test]
    fn only_https_urls_on_the_four_image_hosts_are_allowed() {
        assert!(allowed("https://image.tmdb.org/t/p/w500/a.jpg"));
        assert!(allowed(
            "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/b.png"
        ));
        assert!(allowed("https://media.rawg.io/media/games/00d/x.jpg"));
        assert!(allowed(
            "https://is3-ssl.mzstatic.com/image/thumb/a/600x600bb.jpg"
        ));
        assert!(!allowed("http://image.tmdb.org/t/p/w500/a.jpg"));
        assert!(!allowed("https://example.com/p.jpg"));
        assert!(!allowed("https://mzstatic.com.evil.io/a.jpg"));
        assert!(!allowed("https://image.tmdb.org.evil.io/a.jpg"));
        assert!(!allowed("not a url"));
    }

    #[test]
    fn download_url_asks_for_a_card_size() {
        assert_eq!(
            download_url("https://image.tmdb.org/t/p/w500/a.jpg"),
            "https://image.tmdb.org/t/p/w342/a.jpg"
        );
        assert_eq!(
            download_url("https://media.rawg.io/media/games/00d/x.jpg"),
            "https://media.rawg.io/media/resize/420/-/games/00d/x.jpg"
        );
        assert_eq!(
            download_url("https://is1-ssl.mzstatic.com/image/thumb/a/1200x1200bb.jpg"),
            "https://is1-ssl.mzstatic.com/image/thumb/a/600x600bb.jpg"
        );
        let anilist = "https://s4.anilist.co/file/anilistcdn/media/manga/cover/large/b.png";
        assert_eq!(download_url(anilist), anilist);
    }

    #[test]
    fn image_ext_reads_magic_bytes() {
        assert_eq!(image_ext(&[0xFF, 0xD8, 0xFF, 0xE0]), Some("jpg"));
        assert_eq!(image_ext(&[0x89, b'P', b'N', b'G', 0x0D]), Some("png"));
        assert_eq!(image_ext(b"RIFF\0\0\0\0WEBPVP8 "), Some("webp"));
        assert_eq!(image_ext(b"<html>"), None);
        assert_eq!(image_ext(&[]), None);
    }

    #[test]
    fn file_stem_is_safe_on_every_os() {
        assert_eq!(file_stem("tmdb:movie:1"), "tmdb_movie_1");
        assert_eq!(
            file_stem("rawg:game:grand-theft-auto-v"),
            "rawg_game_grand-theft-auto-v"
        );
        assert_eq!(file_stem("a/../b\\c"), "a____b_c");
    }

    #[test]
    fn orphans_are_files_no_entry_points_to() {
        let present = vec![
            "a.jpg".to_string(),
            "b.png".to_string(),
            "c.jpg.tmp".to_string(),
        ];
        let referenced: BTreeSet<String> = ["a.jpg".to_string()].into();
        assert_eq!(orphans(&present, &referenced), vec!["b.png", "c.jpg.tmp"]);
    }
}
