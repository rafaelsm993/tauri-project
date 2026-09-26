use crate::library::commands::{
    validate_user_data, LibraryFile, MIGRATIONS as LIBRARY_MIGRATIONS,
    SCHEMA_VERSION as LIBRARY_SCHEMA,
};
use crate::library::events::{parse_jsonl, to_jsonl};
use crate::library::posters::{image_ext, MAX_BYTES};
use crate::library::types::Event;
use crate::prefs::{Prefs, MIGRATIONS as PREFS_MIGRATIONS, SCHEMA_VERSION as PREFS_SCHEMA};
use crate::store::file::Versioned;
use crate::store::{upgrade, Migration, UpgradeError};
use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::io::{Cursor, Read, Write};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

// Bumped only when the zip layout changes, not the files inside it.
pub const BUNDLE_FORMAT: u32 = 1;
pub const NOT_A_BACKUP: &str = "This file is not an Aevum backup";
pub const NEWER: &str =
    "This backup was made by a newer version of Aevum. Update Aevum, then import it again.";

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Manifest {
    pub format: u32,
    pub app_version: String,
    pub library_schema: u32,
    pub prefs_schema: u32,
    pub created_at: String,
    pub entries: usize,
    pub events: usize,
    pub posters: usize,
}

// Everything a backup carries, already upgraded to this app's schemas.
#[derive(Debug, Clone, PartialEq)]
pub struct Bundle {
    pub manifest: Manifest,
    pub library: LibraryFile,
    pub events: Vec<Event>,
    pub prefs: Prefs,
    pub posters: Vec<(String, Vec<u8>)>,
}

// Caps that keep a hostile zip from exhausting memory or disk.
#[derive(Debug, Clone, Copy)]
pub struct Limits {
    pub files: usize,
    pub json_bytes: u64,
    pub poster_bytes: u64,
    pub total_bytes: u64,
}

impl Limits {
    pub const DEFAULT: Limits = Limits {
        files: 20_000,
        json_bytes: 64 << 20,
        poster_bytes: MAX_BYTES as u64,
        total_bytes: 1 << 30,
    };
}

pub fn manifest_for(
    library: &LibraryFile,
    events: usize,
    posters: usize,
    created_at: &str,
) -> Manifest {
    Manifest {
        format: BUNDLE_FORMAT,
        app_version: env!("CARGO_PKG_VERSION").into(),
        library_schema: LIBRARY_SCHEMA,
        prefs_schema: PREFS_SCHEMA,
        created_at: created_at.into(),
        entries: library.entries.len(),
        events,
        posters,
    }
}

type Writer = ZipWriter<Cursor<Vec<u8>>>;
type Unpacked = (BTreeMap<String, Vec<u8>>, Vec<(String, Vec<u8>)>);

fn put(
    zip: &mut Writer,
    name: &str,
    bytes: &[u8],
    method: CompressionMethod,
) -> Result<(), String> {
    let opts = SimpleFileOptions::default().compression_method(method);
    zip.start_file(name, opts)
        .map_err(|e| format!("zip {name}: {e}"))?;
    zip.write_all(bytes).map_err(|e| format!("zip {name}: {e}"))
}

fn pretty<T: Serialize>(value: &T) -> Result<Vec<u8>, String> {
    serde_json::to_vec_pretty(value).map_err(|e| format!("serialize: {e}"))
}

// The whole backup in memory; the caller decides where the bytes go.
pub fn build(bundle: &Bundle) -> Result<Vec<u8>, String> {
    let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
    let deflated = CompressionMethod::Deflated;
    put(
        &mut zip,
        "manifest.json",
        &pretty(&bundle.manifest)?,
        deflated,
    )?;
    let library = Versioned {
        schema_version: LIBRARY_SCHEMA,
        data: &bundle.library,
    };
    put(&mut zip, "library.json", &pretty(&library)?, deflated)?;
    put(
        &mut zip,
        "events.jsonl",
        &to_jsonl(&bundle.events)?,
        deflated,
    )?;
    let prefs = Versioned {
        schema_version: PREFS_SCHEMA,
        data: &bundle.prefs,
    };
    put(&mut zip, "prefs.json", &pretty(&prefs)?, deflated)?;
    for (name, bytes) in &bundle.posters {
        let path = format!("posters/{name}");
        put(&mut zip, &path, bytes, CompressionMethod::Stored)?;
    }
    let cursor = zip.finish().map_err(|e| format!("zip: {e}"))?;
    Ok(cursor.into_inner())
}

// A poster keeps a plain `stem.ext` name so it can never leave the posters folder.
fn poster_name(name: &str) -> Option<&str> {
    let (stem, ext) = name.rsplit_once('.')?;
    let plain = !stem.is_empty()
        && stem
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-');
    (plain && matches!(ext, "jpg" | "png" | "webp")).then_some(name)
}

// Unpacks every file under the caps; never trusts the sizes the zip claims.
fn unpack(bytes: &[u8], limits: &Limits) -> Result<Unpacked, String> {
    let mut archive =
        ZipArchive::new(Cursor::new(bytes)).map_err(|e| format!("{NOT_A_BACKUP} ({e})"))?;
    if archive.len() > limits.files {
        return Err(format!(
            "the backup has too many files ({}; the limit is {})",
            archive.len(),
            limits.files
        ));
    }
    let (mut files, mut posters, mut total) = (BTreeMap::new(), Vec::new(), 0u64);
    for i in 0..archive.len() {
        let mut f = archive
            .by_index(i)
            .map_err(|e| format!("{NOT_A_BACKUP} ({e})"))?;
        let name = f.name().to_string();
        if f.enclosed_name().is_none() || name.starts_with('/') || name.contains(['\\', ':']) {
            return Err(format!("the backup contains an unsafe path: {name}"));
        }
        if f.is_dir() {
            continue;
        }
        let poster = name.strip_prefix("posters/");
        let cap = match poster {
            Some(_) => limits.poster_bytes,
            None => limits.json_bytes,
        };
        let mut buf = Vec::new();
        Read::by_ref(&mut f)
            .take(cap + 1)
            .read_to_end(&mut buf)
            .map_err(|e| format!("read {name}: {e}"))?;
        if buf.len() as u64 > cap {
            return Err(format!("{name} in the backup is larger than {cap} bytes"));
        }
        total += buf.len() as u64;
        if total > limits.total_bytes {
            return Err(format!(
                "the backup unpacks to more than {} bytes",
                limits.total_bytes
            ));
        }
        match poster {
            Some(p) => {
                let p = poster_name(p)
                    .ok_or_else(|| format!("the backup contains an unsafe poster name: {name}"))?;
                if image_ext(&buf) != p.rsplit_once('.').map(|(_, e)| e) {
                    return Err(format!("{name} in the backup is not an image"));
                }
                posters.push((p.to_string(), buf));
            }
            None => {
                files.insert(name, buf);
            }
        }
    }
    Ok((files, posters))
}

fn json<T: DeserializeOwned>(files: &BTreeMap<String, Vec<u8>>, name: &str) -> Result<T, String> {
    let bytes = files
        .get(name)
        .ok_or_else(|| format!("{NOT_A_BACKUP} ({name} is missing)"))?;
    serde_json::from_slice(bytes).map_err(|e| format!("{name} in the backup is damaged: {e}"))
}

// Same upgrade path as a file loaded at startup.
fn versioned<T: DeserializeOwned>(
    files: &BTreeMap<String, Vec<u8>>,
    name: &str,
    steps: &[Migration],
) -> Result<T, String> {
    let raw: Versioned<Value> = json(files, name)?;
    upgrade(raw, steps).map(|l| l.data).map_err(|e| match e {
        UpgradeError::Newer { .. } => NEWER.to_string(),
        UpgradeError::Migrate(e) | UpgradeError::Unfit(e) => {
            format!("{name} in the backup is damaged: {e}")
        }
    })
}

// Every entry is keyed by its own media key and holds valid user data.
fn validate(library: &LibraryFile) -> Result<(), String> {
    for (key, e) in &library.entries {
        if *key != e.key || e.key != e.snapshot.media_key {
            return Err(format!("the backup has a mismatched entry: {key}"));
        }
        validate_user_data(e.snapshot.media_type, &e.user)
            .map_err(|err| format!("the backup has an invalid entry {key}: {err}"))?;
    }
    Ok(())
}

// A poster reference survives only if the backup carries that exact file.
fn keep_carried_posters(library: &mut LibraryFile, posters: &[(String, Vec<u8>)]) {
    let carried: BTreeSet<&str> = posters.iter().map(|(n, _)| n.as_str()).collect();
    for e in library.entries.values_mut() {
        if e.snapshot
            .poster_file
            .as_deref()
            .is_some_and(|f| !carried.contains(f))
        {
            e.snapshot.poster_file = None;
        }
    }
}

pub fn read(bytes: &[u8], limits: &Limits) -> Result<Bundle, String> {
    let (files, posters) = unpack(bytes, limits)?;
    let manifest: Manifest = json(&files, "manifest.json")?;
    if manifest.format > BUNDLE_FORMAT {
        return Err(NEWER.into());
    }
    let mut library: LibraryFile = versioned(&files, "library.json", LIBRARY_MIGRATIONS)?;
    validate(&library)?;
    keep_carried_posters(&mut library, &posters);
    let prefs = if files.contains_key("prefs.json") {
        versioned(&files, "prefs.json", PREFS_MIGRATIONS)?
    } else {
        Prefs::default()
    };
    let events = files
        .get("events.jsonl")
        .map(|b| parse_jsonl(&String::from_utf8_lossy(b), "events.jsonl in the backup"))
        .unwrap_or_default();
    Ok(Bundle {
        manifest,
        library,
        events,
        prefs,
        posters,
    })
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::api::types::{Id, MediaItem, MediaType, ProviderId};
    use crate::library::types::tests::event;
    use crate::library::types::{LibraryEntry, MediaSnapshot, UserData};
    use serde_json::json;

    pub(crate) const PNG: [u8; 8] = [0x89, b'P', b'N', b'G', 0x0D, 0x0A, 0x1A, 0x0A];

    pub(crate) fn entry(n: u64, updated_at: &str) -> LibraryEntry {
        let item = MediaItem::new(
            Id::Num(n),
            format!("Movie {n}"),
            MediaType::Movie,
            ProviderId::Tmdb,
        );
        LibraryEntry {
            key: item.media_key.clone(),
            snapshot: MediaSnapshot::from_item(&item),
            user: UserData::default(),
            created_at: updated_at.into(),
            updated_at: updated_at.into(),
        }
    }

    pub(crate) fn library(entries: Vec<LibraryEntry>) -> LibraryFile {
        LibraryFile {
            entries: entries.into_iter().map(|e| (e.key.clone(), e)).collect(),
        }
    }

    pub(crate) fn sample() -> Bundle {
        let mut e = entry(1, "2026-09-20T10:00:00.000Z");
        e.snapshot.poster_file = Some("tmdb_movie_1.png".into());
        let lib = library(vec![e, entry(2, "2026-09-21T10:00:00.000Z")]);
        Bundle {
            manifest: manifest_for(&lib, 2, 1, "2026-09-26T00:00:00.000Z"),
            library: lib,
            events: vec![event("a"), event("b")],
            prefs: Prefs {
                background_animation: false,
            },
            posters: vec![("tmdb_movie_1.png".into(), PNG.to_vec())],
        }
    }

    // Any zip, including hostile names and contents.
    fn zip_with(files: &[(&str, Vec<u8>)]) -> Vec<u8> {
        let mut zip = ZipWriter::new(Cursor::new(Vec::new()));
        for (name, bytes) in files {
            zip.start_file(*name, SimpleFileOptions::default()).unwrap();
            zip.write_all(bytes).unwrap();
        }
        zip.finish().unwrap().into_inner()
    }

    // Same-length byte swap in local header and central directory; names are not CRC-covered.
    fn rename(mut zip: Vec<u8>, from: &str, to: &str) -> Vec<u8> {
        assert_eq!(from.len(), to.len());
        let (f, t) = (from.as_bytes(), to.as_bytes());
        let mut i = 0;
        while i + f.len() <= zip.len() {
            if &zip[i..i + f.len()] == f {
                zip[i..i + f.len()].copy_from_slice(t);
            }
            i += 1;
        }
        zip
    }

    fn manifest_json(format: u32) -> Vec<u8> {
        serde_json::to_vec(&json!({
            "format": format, "app_version": "0.1.0", "library_schema": 1, "prefs_schema": 1,
            "created_at": "2026-09-26T00:00:00.000Z", "entries": 0, "events": 0, "posters": 0
        }))
        .unwrap()
    }

    fn library_json(version: u32, data: serde_json::Value) -> Vec<u8> {
        serde_json::to_vec(&json!({ "schema_version": version, "data": data })).unwrap()
    }

    fn minimal(extra: Vec<(&str, Vec<u8>)>) -> Vec<u8> {
        let mut files = vec![
            ("manifest.json", manifest_json(1)),
            ("library.json", library_json(1, json!({ "entries": {} }))),
        ];
        files.extend(extra);
        zip_with(&files)
    }

    fn named(files: &[(String, Vec<u8>)]) -> Vec<(&str, Vec<u8>)> {
        files.iter().map(|(n, b)| (n.as_str(), b.clone())).collect()
    }

    const SMALL: Limits = Limits {
        files: 8,
        json_bytes: 1024,
        poster_bytes: 64,
        total_bytes: 4096,
    };

    #[test]
    fn a_built_bundle_reads_back_identical() {
        let b = sample();
        assert_eq!(read(&build(&b).unwrap(), &Limits::DEFAULT).unwrap(), b);
    }

    #[test]
    fn a_minimal_bundle_gets_default_prefs_and_no_events() {
        let b = read(&minimal(vec![]), &Limits::DEFAULT).unwrap();
        assert_eq!(b.prefs, Prefs::default());
        assert!(b.events.is_empty() && b.library.entries.is_empty());
    }

    #[test]
    fn random_bytes_are_not_a_backup() {
        let err = read(b"definitely not a zip", &Limits::DEFAULT).unwrap_err();
        assert!(err.starts_with(NOT_A_BACKUP), "{err}");
    }

    #[test]
    fn a_zip_without_a_manifest_is_not_a_backup() {
        let zip = zip_with(&[("library.json", library_json(1, json!({ "entries": {} })))]);
        let err = read(&zip, &Limits::DEFAULT).unwrap_err();
        assert!(
            err.starts_with(NOT_A_BACKUP) && err.contains("manifest.json"),
            "{err}"
        );
    }

    #[test]
    fn a_newer_bundle_format_asks_to_update() {
        let zip = zip_with(&[
            ("manifest.json", manifest_json(99)),
            ("library.json", library_json(1, json!({}))),
        ]);
        assert_eq!(read(&zip, &Limits::DEFAULT).unwrap_err(), NEWER);
    }

    #[test]
    fn a_newer_library_schema_asks_to_update() {
        let zip = zip_with(&[
            ("manifest.json", manifest_json(1)),
            ("library.json", library_json(99, json!({}))),
        ]);
        assert_eq!(read(&zip, &Limits::DEFAULT).unwrap_err(), NEWER);
    }

    #[test]
    fn a_parent_dir_path_is_rejected() {
        let zip = rename(
            minimal(vec![("xx/evil.json", b"{}".to_vec())]),
            "xx/evil",
            "../evil",
        );
        let err = read(&zip, &Limits::DEFAULT).unwrap_err();
        assert!(err.contains("unsafe path"), "{err}");
    }

    #[test]
    fn an_absolute_path_is_rejected() {
        let zip = rename(
            minimal(vec![("Xetc/passwd", b"x".to_vec())]),
            "Xetc/passwd",
            "/etc/passwd",
        );
        let err = read(&zip, &Limits::DEFAULT).unwrap_err();
        assert!(err.contains("unsafe path"), "{err}");
    }

    #[test]
    fn a_poster_escaping_its_folder_is_rejected() {
        let zip = minimal(vec![("posters/a/../../x.png", PNG.to_vec())]);
        let err = read(&zip, &Limits::DEFAULT).unwrap_err();
        assert!(err.contains("unsafe"), "{err}");
    }

    #[test]
    fn a_poster_that_is_not_an_image_is_rejected() {
        let zip = minimal(vec![("posters/tmdb_movie_1.png", b"not an image".to_vec())]);
        let err = read(&zip, &Limits::DEFAULT).unwrap_err();
        assert!(err.contains("not an image"), "{err}");
    }

    #[test]
    fn too_many_files_is_rejected() {
        let many: Vec<(String, Vec<u8>)> =
            (0..10).map(|i| (format!("junk{i}.txt"), vec![])).collect();
        let err = read(&minimal(named(&many)), &SMALL).unwrap_err();
        assert!(err.contains("too many files"), "{err}");
    }

    #[test]
    fn a_compressed_bomb_is_stopped_at_the_file_cap() {
        let head = b"{\"schema_version\":1,\"data\":{\"entries\":{}}}".as_slice();
        let bomb = [head, &vec![b' '; 100_000]].concat();
        let zip = zip_with(&[("manifest.json", manifest_json(1)), ("library.json", bomb)]);
        assert!(zip.len() < 2_000, "the fixture must compress well");
        let err = read(&zip, &SMALL).unwrap_err();
        assert!(err.contains("larger than"), "{err}");
    }

    #[test]
    fn the_total_unpacked_size_is_capped() {
        let files: Vec<(String, Vec<u8>)> = (0..5)
            .map(|i| (format!("f{i}.txt"), vec![b'a'; 1000]))
            .collect();
        let err = read(&minimal(named(&files)), &SMALL).unwrap_err();
        assert!(err.contains("unpacks to more than"), "{err}");
    }

    #[test]
    fn an_invalid_entry_rejects_the_whole_backup() {
        let mut bad = entry(1, "t");
        bad.user.rating = Some(12);
        let mut b = sample();
        b.library = library(vec![bad]);
        let err = read(&build(&b).unwrap(), &Limits::DEFAULT).unwrap_err();
        assert!(
            err.contains("tmdb:movie:1") && err.contains("1–10"),
            "{err}"
        );
    }

    #[test]
    fn poster_references_without_a_file_in_the_backup_are_dropped() {
        let mut b = sample();
        b.posters.clear();
        let back = read(&build(&b).unwrap(), &Limits::DEFAULT).unwrap();
        assert_eq!(
            back.library.entries["tmdb:movie:1"].snapshot.poster_file,
            None
        );
    }

    #[test]
    fn a_hostile_poster_file_reference_is_dropped() {
        let mut b = sample();
        let e = b.library.entries.get_mut("tmdb:movie:2").unwrap();
        e.snapshot.poster_file = Some("../../etc/passwd".into());
        let back = read(&build(&b).unwrap(), &Limits::DEFAULT).unwrap();
        assert_eq!(
            back.library.entries["tmdb:movie:2"].snapshot.poster_file,
            None
        );
    }
}
