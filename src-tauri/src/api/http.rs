//! Shared `reqwest::Client` (keeps the connection pool and TLS cache) and request path.
use super::cache::ResponseCache;
use reqwest::{Client, RequestBuilder};
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::{LazyLock, Mutex};
use std::time::{Duration, Instant};

static CLIENT: LazyLock<Client> = LazyLock::new(|| {
    Client::builder()
        .user_agent(concat!("tauri-app/", env!("CARGO_PKG_VERSION")))
        .build()
        .unwrap_or_else(|_| Client::new())
});

pub fn client() -> &'static Client {
    &CLIENT
}

static CACHE: LazyLock<ResponseCache> =
    LazyLock::new(|| ResponseCache::new(Duration::from_secs(300), 256));

// Provider → instant its 429 back-off ends.
static COOLDOWN: LazyLock<Mutex<HashMap<String, Instant>>> = LazyLock::new(Default::default);

const DEFAULT_BACKOFF: Duration = Duration::from_secs(30);

fn cooling_down(provider: &str) -> Option<Duration> {
    let map = COOLDOWN.lock().ok()?;
    map.get(provider)?.checked_duration_since(Instant::now())
}

fn start_cooldown(provider: &str, retry_after: Option<&str>) {
    let wait = retry_after
        .and_then(|s| s.trim().parse::<u64>().ok())
        .map_or(DEFAULT_BACKOFF, Duration::from_secs);
    if let Ok(mut map) = COOLDOWN.lock() {
        map.insert(provider.to_owned(), Instant::now() + wait);
    }
}

// Method, URL (with query) and body identify a response; None when the body streams.
fn cache_key(req: &RequestBuilder) -> Option<String> {
    let built = req.try_clone()?.build().ok()?;
    let body = match built.body() {
        Some(b) => String::from_utf8_lossy(b.as_bytes()?).into_owned(),
        None => String::new(),
    };
    Some(format!("{} {} {body}", built.method(), built.url()))
}

/// Strips the URL from the error so API keys in query params never reach logs or the UI.
pub fn request_error(provider: &str, e: reqwest::Error) -> String {
    let msg = e.without_url().to_string();
    log::error!("[{provider}] {msg}");
    msg
}

/// Serves a fresh cached body or joins an identical request in flight, else fetches.
pub async fn fetch_json(provider: &str, op: &str, req: RequestBuilder) -> Result<Value, String> {
    let Some(key) = cache_key(&req) else {
        return fetch_uncached(provider, op, req).await;
    };
    let mut fetched = false;
    let out = CACHE
        .get_or_fetch(key, || {
            fetched = true;
            fetch_uncached(provider, op, req)
        })
        .await;
    if !fetched {
        log::info!("[{provider}] {op} → cache hit");
    }
    out
}

/// Non-2xx becomes `Err` with the provider message; logs a summary only, never body or URL.
async fn fetch_uncached(provider: &str, op: &str, req: RequestBuilder) -> Result<Value, String> {
    if let Some(left) = cooling_down(provider) {
        let msg = format!(
            "{provider}: rate limited, retry in {}s",
            left.as_secs_f64().ceil()
        );
        log::warn!("[{provider}] {op} → skipped: {msg}");
        return Err(msg);
    }
    let started = Instant::now();
    let resp = req.send().await.map_err(|e| request_error(provider, e))?;
    let status = resp.status();
    let retry_after = resp
        .headers()
        .get(reqwest::header::RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);
    let text = resp.text().await.map_err(|e| request_error(provider, e))?;
    let ms = started.elapsed().as_millis();
    let body: Option<Value> = serde_json::from_str(&text).ok();

    if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
        start_cooldown(provider, retry_after.as_deref());
    }
    if !status.is_success() {
        let msg = body
            .as_ref()
            .and_then(provider_error_message)
            .unwrap_or_else(|| format!("HTTP {}", status.as_u16()));
        let retry = retry_after
            .map(|s| format!(" (retry after {s}s)"))
            .unwrap_or_default();
        log::warn!(
            "[{provider}] {op} → HTTP {} in {ms}ms: {msg}{retry}",
            status.as_u16()
        );
        return Err(msg);
    }

    let Some(body) = body else {
        let msg = format!("{provider}: response was not valid JSON");
        log::error!("[{provider}] {op} → {} in {ms}ms: {msg}", status.as_u16());
        return Err(msg);
    };
    log::info!(
        "[{provider}] {op} → {} in {ms}ms, {}",
        status.as_u16(),
        describe_count(result_count(&body))
    );
    Ok(body)
}

/// Reads a provider body into its typed raw struct.
pub fn decode<T: DeserializeOwned>(provider: &str, body: Value) -> Result<T, String> {
    serde_json::from_value(body).map_err(|e| {
        let msg = format!("{provider}: unexpected response ({e})");
        log::error!("[{provider}] {msg}");
        msg
    })
}

pub async fn fetch<T: DeserializeOwned>(
    provider: &str,
    op: &str,
    req: RequestBuilder,
) -> Result<T, String> {
    decode(provider, fetch_json(provider, op, req).await?)
}

/// TMDB/RAWG/iTunes list under `results`; AniList under `data.Page.media`.
fn result_count(body: &Value) -> Option<usize> {
    body.get("results")
        .or_else(|| body.pointer("/data/Page/media"))
        .and_then(Value::as_array)
        .map(Vec::len)
}

fn describe_count(count: Option<usize>) -> String {
    match count {
        Some(1) => "1 result".to_string(),
        Some(n) => format!("{n} results"),
        None => "1 item".to_string(),
    }
}

/// Reads TMDB `status_message`, RAWG `detail`/`error`, AniList `errors[].message`, iTunes `errorMessage`.
fn provider_error_message(body: &Value) -> Option<String> {
    let direct = ["status_message", "detail", "errorMessage", "error"]
        .iter()
        .find_map(|k| body.get(*k).and_then(Value::as_str));
    if let Some(msg) = direct {
        return Some(msg.to_string());
    }
    let joined = body
        .get("errors")?
        .as_array()?
        .iter()
        .filter_map(|e| e.get("message").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("; ");
    (!joined.is_empty()).then_some(joined)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    const SECRET: &str = "sup3r-s3cret-key";

    async fn failing_request() -> reqwest::Error {
        client()
            .get(format!("http://127.0.0.1:1/x?api_key={SECRET}"))
            .send()
            .await
            .expect_err("port 1 must refuse the connection")
    }

    /// One-shot local server; the returned URL carries a fake key like real providers.
    async fn serve_once(status_line: &'static str, body: &'static str) -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (mut sock, _) = listener.accept().await.unwrap();
            let mut buf = [0u8; 2048];
            let _ = sock.read(&mut buf).await;
            let resp = format!(
                "HTTP/1.1 {status_line}\r\nContent-Type: application/json\r\n\
                 Retry-After: 30\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                body.len()
            );
            sock.write_all(resp.as_bytes()).await.unwrap();
        });
        format!("http://{addr}/x{}?api_key={SECRET}", addr.port())
    }

    #[test]
    fn client_is_a_single_shared_instance() {
        assert!(std::ptr::eq(client(), client()));
    }

    #[tokio::test]
    async fn raw_reqwest_error_does_leak_the_key() {
        assert!(failing_request().await.to_string().contains(SECRET));
    }

    #[tokio::test]
    async fn request_error_strips_the_url_and_key() {
        let msg = request_error("test", failing_request().await);
        assert!(!msg.contains(SECRET), "key leaked: {msg}");
        assert!(!msg.contains("127.0.0.1"), "url leaked: {msg}");
        assert!(!msg.is_empty());
    }

    #[tokio::test]
    async fn fetch_json_returns_the_body_on_success() {
        let url = serve_once("200 OK", r#"{"results":[1,2,3]}"#).await;
        let body = fetch_json("test", "op", client().get(url)).await.unwrap();
        assert_eq!(body["results"].as_array().unwrap().len(), 3);
    }

    #[tokio::test]
    async fn fetch_json_turns_http_errors_into_err_with_provider_message() {
        let url = serve_once(
            "401 Unauthorized",
            r#"{"status_message":"Invalid API key: You must be granted a valid key."}"#,
        )
        .await;
        let err = fetch_json("test", "op", client().get(url))
            .await
            .unwrap_err();
        assert!(err.contains("Invalid API key"), "got: {err}");
        assert!(!err.contains(SECRET), "key leaked: {err}");
    }

    #[tokio::test]
    async fn fetch_json_falls_back_to_status_code_when_body_is_not_json() {
        let url = serve_once("429 Too Many Requests", "slow down").await;
        let err = fetch_json("test-429-body", "op", client().get(url))
            .await
            .unwrap_err();
        assert_eq!(err, "HTTP 429");
    }

    #[tokio::test]
    async fn a_repeated_request_is_served_from_the_cache() {
        let url = serve_once("200 OK", r#"{"results":[1]}"#).await;
        let first = fetch_json("test", "op", client().get(&url)).await.unwrap();
        let second = fetch_json("test", "op", client().get(&url)).await.unwrap();
        assert_eq!(first, second);
    }

    #[tokio::test]
    async fn a_429_pauses_that_provider_until_retry_after() {
        let url = serve_once("429 Too Many Requests", "{}").await;
        assert_eq!(
            fetch_json("test-cooldown", "op", client().get(url)).await,
            Err("HTTP 429".into())
        );
        let next = client().get(format!("http://127.0.0.1:1/other?api_key={SECRET}"));
        let err = fetch_json("test-cooldown", "op", next).await.unwrap_err();
        assert!(err.contains("rate limited"), "got: {err}");
        assert!(err.contains("30s"), "got: {err}");
    }

    #[test]
    fn cache_key_tells_post_bodies_apart() {
        let key = |q: &str| cache_key(&client().post("http://h/graphql").body(q.to_owned()));
        assert_ne!(key("{\"page\":1}"), key("{\"page\":2}"));
        assert_eq!(key("{\"page\":1}"), key("{\"page\":1}"));
    }

    #[test]
    fn result_count_reads_rest_and_graphql_shapes() {
        assert_eq!(result_count(&json!({"results": [1, 2]})), Some(2));
        assert_eq!(
            result_count(&json!({"data": {"Page": {"media": [1, 2, 3]}}})),
            Some(3)
        );
        assert_eq!(result_count(&json!({"id": 7, "title": "x"})), None);
    }

    #[test]
    fn decode_reports_shape_errors_with_the_provider_name() {
        let err = decode::<Vec<u32>>("tmdb", json!({"a": 1})).unwrap_err();
        assert!(err.starts_with("tmdb: unexpected response"), "got: {err}");
        assert_eq!(decode::<Vec<u32>>("x", json!([1, 2])).unwrap(), vec![1, 2]);
    }

    #[test]
    fn describe_count_is_readable() {
        assert_eq!(describe_count(Some(0)), "0 results");
        assert_eq!(describe_count(Some(1)), "1 result");
        assert_eq!(describe_count(Some(20)), "20 results");
        assert_eq!(describe_count(None), "1 item");
    }

    #[test]
    fn provider_error_message_covers_every_provider_shape() {
        assert_eq!(
            provider_error_message(&json!({"status_message": "bad key"})).as_deref(),
            Some("bad key")
        );
        assert_eq!(
            provider_error_message(&json!({"detail": "Not found."})).as_deref(),
            Some("Not found.")
        );
        assert_eq!(
            provider_error_message(&json!({"errors": [{"message": "a"}, {"message": "b"}]}))
                .as_deref(),
            Some("a; b")
        );
        assert_eq!(
            provider_error_message(&json!({"errorMessage": "Invalid value"})).as_deref(),
            Some("Invalid value")
        );
        assert_eq!(provider_error_message(&json!({"results": []})), None);
    }
}
