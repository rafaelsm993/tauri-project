use super::types::Event;
use crate::store::file::write_atomic;
use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::Path;

// Appends one JSON line and fsyncs; a torn tail from a crash is closed off first.
pub fn append_event(path: &Path, event: &Event) -> Result<(), String> {
    let mut line = serde_json::to_vec(event).map_err(|e| format!("serialize event: {e}"))?;
    line.push(b'\n');
    let torn = fs::read(path)
        .map(|b| !b.is_empty() && !b.ends_with(b"\n"))
        .unwrap_or(false);
    let mut f = OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| format!("open {}: {e}", path.display()))?;
    if torn {
        f.write_all(b"\n")
            .map_err(|e| format!("write {}: {e}", path.display()))?;
    }
    f.write_all(&line)
        .map_err(|e| format!("write {}: {e}", path.display()))?;
    f.sync_all()
        .map_err(|e| format!("fsync {}: {e}", path.display()))
}

// Reads the log in order, keeping the first event per id and skipping unreadable lines.
pub fn read_events(path: &Path) -> Result<Vec<Event>, String> {
    match fs::read_to_string(path) {
        Ok(text) => Ok(parse_jsonl(&text, &path.display().to_string())),
        Err(e) if e.kind() == ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(format!("read {}: {e}", path.display())),
    }
}

// `source` only names the text in warnings.
pub fn parse_jsonl(text: &str, source: &str) -> Vec<Event> {
    let mut seen = HashSet::new();
    let mut events = Vec::new();
    for (n, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Event>(line) {
            Ok(e) if seen.insert(e.id.clone()) => events.push(e),
            Ok(_) => {}
            Err(e) => log::warn!("[events] {source} line {}: {e}", n + 1),
        }
    }
    events
}

pub fn to_jsonl(events: &[Event]) -> Result<Vec<u8>, String> {
    let mut out = Vec::new();
    for e in events {
        out.extend(serde_json::to_vec(e).map_err(|err| format!("serialize event: {err}"))?);
        out.push(b'\n');
    }
    Ok(out)
}

// Rewrites the whole log atomically, e.g. after an import.
pub fn write_events(path: &Path, events: &[Event]) -> Result<(), String> {
    write_atomic(path, &to_jsonl(events)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::types::tests::event;
    use crate::store::file::tests::scratch;

    fn ids(events: &[Event]) -> Vec<&str> {
        events.iter().map(|e| e.id.as_str()).collect()
    }

    #[test]
    fn appended_events_read_back_in_order() {
        let dir = scratch("events");
        let path = dir.join("events.jsonl");
        append_event(&path, &event("a")).unwrap();
        append_event(&path, &event("b")).unwrap();
        assert_eq!(ids(&read_events(&path).unwrap()), ["a", "b"]);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn replaying_the_same_event_id_counts_once() {
        let dir = scratch("replay");
        let path = dir.join("events.jsonl");
        for id in ["a", "b", "a", "b", "a"] {
            append_event(&path, &event(id)).unwrap();
        }
        assert_eq!(ids(&read_events(&path).unwrap()), ["a", "b"]);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_torn_last_line_is_skipped() {
        let dir = scratch("torn");
        let path = dir.join("events.jsonl");
        append_event(&path, &event("a")).unwrap();
        let mut bytes = fs::read(&path).unwrap();
        bytes.extend_from_slice(b"{\"id\":\"b\",\"kind\":\"sta");
        fs::write(&path, bytes).unwrap();
        assert_eq!(ids(&read_events(&path).unwrap()), ["a"]);
        append_event(&path, &event("c")).unwrap();
        assert_eq!(ids(&read_events(&path).unwrap()), ["a", "c"]);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_missing_log_is_empty() {
        let dir = scratch("nolog");
        assert!(read_events(&dir.join("events.jsonl")).unwrap().is_empty());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn jsonl_text_round_trips_and_dedupes() {
        let bytes = to_jsonl(&[event("a"), event("b"), event("a")]).unwrap();
        let text = String::from_utf8(bytes).unwrap();
        assert_eq!(text.lines().count(), 3);
        assert_eq!(ids(&parse_jsonl(&text, "test")), ["a", "b"]);
    }

    #[test]
    fn write_events_replaces_the_whole_log() {
        let dir = scratch("rewrite");
        let path = dir.join("events.jsonl");
        append_event(&path, &event("old")).unwrap();
        write_events(&path, &[event("x"), event("y")]).unwrap();
        assert_eq!(ids(&read_events(&path).unwrap()), ["x", "y"]);
        fs::remove_dir_all(&dir).unwrap();
    }
}
