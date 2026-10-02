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

#[cfg(any(unix, test))]
const SHARED_STORAGE: [&str; 3] = ["/storage/", "/data/media/", "/mnt/user/"];

// `/storage/emulated/0/Download/a.zip` → `Download/a.zip`; private or unnamed links give `None`.
#[cfg(any(unix, test))]
fn name_from_link(link: &Path) -> Option<String> {
    let full = link.to_str()?;
    if !SHARED_STORAGE.iter().any(|root| full.starts_with(root)) || full.ends_with(" (deleted)") {
        return None;
    }
    let name = link.file_name()?.to_str()?;
    if !name.contains('.') {
        return None;
    }
    let folder = link.parent()?.file_name()?.to_str()?;
    if folder.chars().all(|c| c.is_ascii_digit()) {
        return Some(name.to_string());
    }
    Some(format!("{folder}/{name}"))
}

// Where an open document really lives, for providers whose URI hides the name (Downloads).
#[cfg(unix)]
fn name_of_open(file: &File) -> Option<String> {
    use std::os::fd::AsRawFd;
    let link = std::fs::read_link(format!("/proc/self/fd/{}", file.as_raw_fd())).ok()?;
    name_from_link(&link)
}

#[cfg(not(unix))]
fn name_of_open(_file: &File) -> Option<String> {
    None
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

// Copies the verified bytes into the chosen document, reads them back to prove the copy, and
// returns the name the status line shows.
pub fn copy_into(files: &impl Files, target: &FilePath, bytes: &[u8]) -> Result<String, String> {
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
    let found = name_of_open(&file);
    drop(file);
    let limit = Limits {
        total_bytes: bytes.len() as u64,
        ..Limits::DEFAULT
    };
    let back = read_from(files, target, &limit).map_err(failed)?;
    if back != bytes {
        return Err(failed("the copy does not match the backup".into()));
    }
    let shown = display(target);
    Ok(if shown == UNNAMED {
        found.unwrap_or(shown)
    } else {
        shown
    })
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
    fn a_shared_storage_link_shows_its_place() {
        for (link, shown) in [
            (
                "/storage/emulated/0/Download/aevum-backup-2026-10-01.zip",
                "Download/aevum-backup-2026-10-01.zip",
            ),
            ("/data/media/0/Download/a.zip", "Download/a.zip"),
            ("/storage/1234-ABCD/Backups/a.zip", "Backups/a.zip"),
        ] {
            assert_eq!(
                name_from_link(Path::new(link)).as_deref(),
                Some(shown),
                "{link}"
            );
        }
    }

    #[test]
    fn a_private_or_odd_link_shows_nothing() {
        for link in [
            "pipe:[1234]",
            "anon_inode:[memfd]",
            "/data/user/0/com.google.android.apps.docs/cache/x.zip",
            "/storage/emulated/0/Download/a.zip (deleted)",
            "/storage/emulated/0/Download/noext",
            "/storage/emulated/0",
            "/home/me/aevum-backup.zip",
        ] {
            assert_eq!(name_from_link(Path::new(link)), None, "{link}");
        }
    }

    #[test]
    fn a_copy_that_reads_back_the_same_is_accepted() {
        let dir = crate::store::file::tests::scratch("copy-ok");
        let files = FakeFiles::new(dir.clone());
        let shown = copy_into(&files, &uri("content://x/document/a.zip"), b"backup bytes").unwrap();
        assert_eq!(shown, "a.zip");
        assert_eq!(std::fs::read(files.doc()).unwrap(), b"backup bytes");
        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn an_opaque_document_outside_shared_storage_stays_unnamed() {
        let dir = crate::store::file::tests::scratch("copy-opaque");
        let files = FakeFiles::new(dir.clone());
        let target = uri("content://com.android.providers.downloads.documents/document/msf%3A1");
        assert_eq!(
            copy_into(&files, &target, b"backup bytes").unwrap(),
            UNNAMED
        );
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
