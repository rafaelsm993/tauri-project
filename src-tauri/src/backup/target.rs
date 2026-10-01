use super::bundle::Limits;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use tauri_plugin_fs::{FilePath, OpenOptions};

pub const UNNAMED: &str = "the chosen file";

// Opens what the file picker returned: a path on desktop, a document the user granted on Android.
pub trait Files {
    fn open(&self, target: &FilePath, opts: OpenOptions) -> std::io::Result<File>;
}

impl<R: tauri::Runtime> Files for tauri_plugin_fs::Fs<R> {
    fn open(&self, target: &FilePath, opts: OpenOptions) -> std::io::Result<File> {
        tauri_plugin_fs::Fs::open(self, target.clone(), opts)
    }
}

fn reading() -> OpenOptions {
    let mut o = OpenOptions::new();
    o.read(true);
    o
}

fn replacing() -> OpenOptions {
    let mut o = OpenOptions::new();
    o.write(true).truncate(true).create(true);
    o
}

// What the status line shows: the path, or a document's readable name, never a raw URI.
pub fn display(target: &FilePath) -> String {
    match target {
        FilePath::Path(p) => p.display().to_string(),
        FilePath::Url(u) => readable_name(u).unwrap_or_else(|| UNNAMED.into()),
    }
}

// `…/document/primary%3ADownload%2Faevum-backup.zip` → `Download/aevum-backup.zip`.
fn readable_name(u: &tauri::Url) -> Option<String> {
    let last = u.path_segments()?.next_back()?;
    let decoded = percent_encoding::percent_decode_str(last)
        .decode_utf8()
        .ok()?;
    let name = decoded.rsplit_once(':').map_or(&*decoded, |(_, rest)| rest);
    let looks_like_a_file = name.contains('.') && !name.contains(['=', ';']);
    looks_like_a_file.then(|| name.to_string())
}

// Reads at most `limit` bytes; one byte more means the file cannot be a backup.
pub fn read_capped(reader: impl Read, limit: u64) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    reader
        .take(limit.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|e| format!("Could not read the backup: {e}"))?;
    if bytes.len() as u64 > limit {
        return Err(format!(
            "the file is too large to be an Aevum backup (more than {limit} bytes)"
        ));
    }
    Ok(bytes)
}

pub fn read_from(
    files: &impl Files,
    target: &FilePath,
    limits: &Limits,
) -> Result<Vec<u8>, String> {
    let file = files
        .open(target, reading())
        .map_err(|e| format!("Could not read the backup: {e}"))?;
    read_capped(file, limits.total_bytes)
}

// Copies the verified bytes into the chosen document and reads them back to prove the copy.
pub fn copy_into(files: &impl Files, target: &FilePath, bytes: &[u8]) -> Result<(), String> {
    let failed = |e: String| {
        format!(
            "The backup could not be written to {}: {e}",
            display(target)
        )
    };
    let mut file = files
        .open(target, replacing())
        .map_err(|e| failed(e.to_string()))?;
    file.write_all(bytes).map_err(|e| failed(e.to_string()))?;
    file.sync_all().map_err(|e| failed(e.to_string()))?;
    drop(file);
    let limit = Limits {
        total_bytes: bytes.len() as u64,
        ..Limits::DEFAULT
    };
    let back = read_from(files, target, &limit).map_err(failed)?;
    if back != bytes {
        return Err(failed("the copy does not match the backup".into()));
    }
    Ok(())
}

// The staging copy and the `.bak` a previous run may have left beside it.
pub fn clean_staging(staging: &Path) {
    for p in [
        staging.to_path_buf(),
        crate::store::file::sibling(staging, ".bak"),
    ] {
        let _ = std::fs::remove_file(p);
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;
    use std::cell::Cell;
    use std::path::PathBuf;

    // Maps every URI to one file in a scratch folder; `corrupt` flips a byte after each write.
    pub struct FakeFiles {
        pub dir: PathBuf,
        pub corrupt: bool,
        pub opened: Cell<usize>,
    }

    impl FakeFiles {
        pub fn new(dir: PathBuf) -> Self {
            Self {
                dir,
                corrupt: false,
                opened: Cell::new(0),
            }
        }

        pub fn doc(&self) -> PathBuf {
            self.dir.join("document.bin")
        }
    }

    impl Files for FakeFiles {
        fn open(&self, target: &FilePath, opts: OpenOptions) -> std::io::Result<File> {
            self.opened.set(self.opened.get() + 1);
            let FilePath::Url(_) = target else {
                panic!("the fake only serves URIs");
            };
            let doc = self.doc();
            if self.corrupt && doc.exists() {
                let mut bytes = std::fs::read(&doc)?;
                if let Some(b) = bytes.first_mut() {
                    *b ^= 0xff;
                }
                std::fs::write(&doc, bytes)?;
            }
            std::fs::OpenOptions::from(opts).open(doc)
        }
    }

    pub fn uri(s: &str) -> FilePath {
        FilePath::Url(tauri::Url::parse(s).unwrap())
    }

    #[test]
    fn a_path_shows_as_the_path() {
        let p = PathBuf::from("/home/me/aevum-backup.zip");
        assert_eq!(display(&FilePath::Path(p.clone())), p.display().to_string());
    }

    #[test]
    fn a_document_shows_its_readable_name() {
        let u = uri("content://com.android.externalstorage.documents/document/primary%3ADownload%2Faevum-backup-2026-09-27.zip");
        assert_eq!(display(&u), "Download/aevum-backup-2026-09-27.zip");
    }

    #[test]
    fn an_opaque_document_never_shows_the_raw_uri() {
        for s in [
            "content://com.android.providers.downloads.documents/document/msf%3A1000012345",
            "content://com.google.android.apps.docs.storage/document/acc%3D1%3Bdoc%3Dencoded%3Dabc.def",
            "content://media/",
        ] {
            assert_eq!(display(&uri(s)), UNNAMED, "{s}");
        }
    }

    #[test]
    fn reading_stops_one_byte_past_the_limit() {
        assert_eq!(read_capped(&[1u8, 2, 3][..], 3).unwrap(), vec![1, 2, 3]);
        let err = read_capped(&[0u8; 10][..], 5).unwrap_err();
        assert!(err.contains("too large"), "{err}");
    }

    #[test]
    fn a_copy_that_reads_back_the_same_is_accepted() {
        let dir = crate::store::file::tests::scratch("copy-ok");
        let files = FakeFiles::new(dir.clone());
        copy_into(&files, &uri("content://x/document/a.zip"), b"backup bytes").unwrap();
        assert_eq!(std::fs::read(files.doc()).unwrap(), b"backup bytes");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn a_copy_that_reads_back_different_is_reported_with_the_name() {
        let dir = crate::store::file::tests::scratch("copy-bad");
        let mut files = FakeFiles::new(dir.clone());
        files.corrupt = true;
        let target = uri("content://x/document/primary%3ADownload%2Fb.zip");
        let err = copy_into(&files, &target, b"backup bytes").unwrap_err();
        assert!(
            err.contains("could not be written to Download/b.zip"),
            "{err}"
        );
        std::fs::remove_dir_all(&dir).unwrap();
    }
}
