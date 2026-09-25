use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::fs::{self, File, OpenOptions};
use std::io::{ErrorKind, Write};
use std::path::{Path, PathBuf};

// On-disk wrapper so every file carries its schema version.
#[derive(Serialize, Deserialize, Debug, PartialEq, Clone)]
pub struct Versioned<T> {
    pub schema_version: u32,
    pub data: T,
}

pub(crate) fn sibling(path: &Path, ext: &str) -> PathBuf {
    let mut p = path.as_os_str().to_owned();
    p.push(ext);
    PathBuf::from(p)
}

// temp → fsync → keep the previous file as .bak → rename over the target.
pub fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let tmp = sibling(path, ".tmp");
    let mut f = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&tmp)
        .map_err(|e| format!("open {}: {e}", tmp.display()))?;
    f.write_all(bytes)
        .map_err(|e| format!("write {}: {e}", tmp.display()))?;
    f.sync_all()
        .map_err(|e| format!("fsync {}: {e}", tmp.display()))?;
    if path.exists() {
        fs::copy(path, sibling(path, ".bak"))
            .map_err(|e| format!("backup {}: {e}", path.display()))?;
    }
    fs::rename(&tmp, path).map_err(|e| format!("rename {}: {e}", path.display()))?;
    if let Some(dir) = path.parent() {
        let _ = File::open(dir).and_then(|d| d.sync_all());
    }
    Ok(())
}

// Reads the file, falling back to .bak when the main file is missing or corrupt.
pub fn read_with_recovery<T: DeserializeOwned>(
    path: &Path,
) -> Result<Option<Versioned<T>>, String> {
    for candidate in [path.to_path_buf(), sibling(path, ".bak")] {
        match fs::read(&candidate) {
            Ok(bytes) => match serde_json::from_slice(&bytes) {
                Ok(v) => return Ok(Some(v)),
                Err(e) => log::warn!("[store] {} unreadable: {e}", candidate.display()),
            },
            Err(e) if e.kind() == ErrorKind::NotFound => {}
            Err(e) => return Err(format!("read {}: {e}", candidate.display())),
        }
    }
    Ok(None)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    pub(crate) fn scratch(name: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "tauri-app-store-{}-{name}-{nanos}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn v(n: u32) -> Versioned<Vec<u32>> {
        Versioned {
            schema_version: 1,
            data: vec![n],
        }
    }

    fn save(path: &Path, value: &Versioned<Vec<u32>>) {
        write_atomic(path, &serde_json::to_vec(value).unwrap()).unwrap();
    }

    fn load(path: &Path) -> Option<Versioned<Vec<u32>>> {
        read_with_recovery(path).unwrap()
    }

    #[test]
    fn round_trips_a_versioned_value() {
        let dir = scratch("roundtrip");
        let path = dir.join("library.json");
        save(&path, &v(1));
        assert_eq!(load(&path), Some(v(1)));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn missing_file_reads_as_none() {
        let dir = scratch("missing");
        assert_eq!(load(&dir.join("library.json")), None);
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn second_write_keeps_the_previous_as_bak() {
        let dir = scratch("bak");
        let path = dir.join("library.json");
        save(&path, &v(1));
        save(&path, &v(2));
        assert_eq!(load(&path), Some(v(2)));
        assert_eq!(load(&dir.join("library.json.bak")), Some(v(1)));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn crash_before_rename_leaves_the_old_file_intact() {
        let dir = scratch("crash");
        let path = dir.join("library.json");
        save(&path, &v(1));
        fs::write(dir.join("library.json.tmp"), b"{\"schema_ver").unwrap();
        assert_eq!(load(&path), Some(v(1)));
        save(&path, &v(2));
        assert_eq!(load(&path), Some(v(2)));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn corrupt_main_file_recovers_from_bak() {
        let dir = scratch("corrupt");
        let path = dir.join("library.json");
        save(&path, &v(1));
        save(&path, &v(2));
        fs::write(&path, b"{\"schema").unwrap();
        assert_eq!(load(&path), Some(v(1)));
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn both_corrupt_reads_as_none() {
        let dir = scratch("both");
        let path = dir.join("library.json");
        fs::write(&path, b"nope").unwrap();
        fs::write(dir.join("library.json.bak"), b"nope").unwrap();
        assert_eq!(load(&path), None);
        fs::remove_dir_all(&dir).unwrap();
    }
}
