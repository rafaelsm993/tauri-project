use super::types::Event;
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
    let text = match fs::read_to_string(path) {
        Ok(t) => t,
        Err(e) if e.kind() == ErrorKind::NotFound => return Ok(Vec::new()),
        Err(e) => return Err(format!("read {}: {e}", path.display())),
    };
    let mut seen = HashSet::new();
    let mut events = Vec::new();
    for (n, line) in text.lines().enumerate() {
        if line.trim().is_empty() {
            continue;
        }
        match serde_json::from_str::<Event>(line) {
            Ok(e) if seen.insert(e.id.clone()) => events.push(e),
            Ok(_) => {}
            Err(e) => log::warn!("[events] {} line {}: {e}", path.display(), n + 1),
        }
    }
    Ok(events)
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
}
