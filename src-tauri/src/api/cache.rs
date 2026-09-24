use serde_json::Value;
use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, OnceCell};

type Cell = Arc<OnceCell<Result<Value, String>>>;

// Memory-only response cache; identical requests in flight share one fetch.
pub struct ResponseCache {
    ttl: Duration,
    max_entries: usize,
    slots: Mutex<HashMap<String, (Instant, Cell)>>,
}

impl ResponseCache {
    pub fn new(ttl: Duration, max_entries: usize) -> Self {
        Self {
            ttl,
            max_entries,
            slots: Mutex::new(HashMap::new()),
        }
    }

    // Returns a fresh cached value, joins an identical fetch in flight, or fetches.
    pub async fn get_or_fetch<F, Fut>(&self, key: String, fetch: F) -> Result<Value, String>
    where
        F: FnOnce() -> Fut,
        Fut: Future<Output = Result<Value, String>>,
    {
        let cell = self.slot(&key).await;
        let out = cell.get_or_init(fetch).await.clone();
        if out.is_err() {
            let mut slots = self.slots.lock().await;
            if slots.get(&key).is_some_and(|(_, c)| Arc::ptr_eq(c, &cell)) {
                slots.remove(&key);
            }
        }
        out
    }

    async fn slot(&self, key: &str) -> Cell {
        let mut slots = self.slots.lock().await;
        let now = Instant::now();
        if let Some((at, cell)) = slots.get(key) {
            if cell.get().is_none() || now.duration_since(*at) < self.ttl {
                return cell.clone();
            }
        }
        if slots.len() >= self.max_entries && !slots.contains_key(key) {
            let oldest = slots
                .iter()
                .min_by_key(|(_, (at, _))| *at)
                .map(|(k, _)| k.clone());
            if let Some(k) = oldest {
                slots.remove(&k);
            }
        }
        let cell: Cell = Arc::new(OnceCell::new());
        slots.insert(key.to_owned(), (now, cell.clone()));
        cell
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::sync::atomic::{AtomicUsize, Ordering};

    fn counting(
        calls: &Arc<AtomicUsize>,
        out: Result<Value, String>,
    ) -> impl Future<Output = Result<Value, String>> {
        let calls = calls.clone();
        async move {
            calls.fetch_add(1, Ordering::SeqCst);
            tokio::time::sleep(Duration::from_millis(20)).await;
            out
        }
    }

    #[tokio::test]
    async fn a_fresh_hit_skips_the_network() {
        let cache = ResponseCache::new(Duration::from_secs(60), 10);
        let calls = Arc::new(AtomicUsize::new(0));
        for _ in 0..3 {
            let v = cache
                .get_or_fetch("k".into(), || counting(&calls, Ok(json!(1))))
                .await;
            assert_eq!(v, Ok(json!(1)));
        }
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn concurrent_identical_requests_share_one_fetch() {
        let cache = Arc::new(ResponseCache::new(Duration::from_secs(60), 10));
        let calls = Arc::new(AtomicUsize::new(0));
        let tasks: Vec<_> = (0..10)
            .map(|_| {
                let (cache, calls) = (cache.clone(), calls.clone());
                tokio::spawn(async move {
                    cache
                        .get_or_fetch("k".into(), || counting(&calls, Ok(json!("page"))))
                        .await
                })
            })
            .collect();
        for t in tasks {
            assert_eq!(t.await.unwrap(), Ok(json!("page")));
        }
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn errors_are_shared_in_flight_but_never_cached() {
        let cache = ResponseCache::new(Duration::from_secs(60), 10);
        let calls = Arc::new(AtomicUsize::new(0));
        let err = cache
            .get_or_fetch("k".into(), || counting(&calls, Err("HTTP 500".into())))
            .await;
        assert_eq!(err, Err("HTTP 500".into()));
        let ok = cache
            .get_or_fetch("k".into(), || counting(&calls, Ok(json!(2))))
            .await;
        assert_eq!(ok, Ok(json!(2)));
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn an_expired_entry_is_fetched_again() {
        let cache = ResponseCache::new(Duration::ZERO, 10);
        let calls = Arc::new(AtomicUsize::new(0));
        cache
            .get_or_fetch("k".into(), || counting(&calls, Ok(json!(1))))
            .await
            .unwrap();
        cache
            .get_or_fetch("k".into(), || counting(&calls, Ok(json!(1))))
            .await
            .unwrap();
        assert_eq!(calls.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn the_oldest_entry_is_evicted_past_the_limit() {
        let cache = ResponseCache::new(Duration::from_secs(60), 2);
        let calls = Arc::new(AtomicUsize::new(0));
        for k in ["a", "b", "c"] {
            cache
                .get_or_fetch(k.into(), || counting(&calls, Ok(json!(k))))
                .await
                .unwrap();
        }
        cache
            .get_or_fetch("c".into(), || counting(&calls, Ok(json!("c"))))
            .await
            .unwrap();
        cache
            .get_or_fetch("b".into(), || counting(&calls, Ok(json!("b"))))
            .await
            .unwrap();
        assert_eq!(calls.load(Ordering::SeqCst), 3);
        cache
            .get_or_fetch("a".into(), || counting(&calls, Ok(json!("a"))))
            .await
            .unwrap();
        assert_eq!(calls.load(Ordering::SeqCst), 4);
    }
}
