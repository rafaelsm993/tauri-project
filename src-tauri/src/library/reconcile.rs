use super::commands::{validate_user_data, LibraryFile};
use super::types::{Length, LibraryEntry, MediaSnapshot, Status, Tombstone, UserData};
use crate::api::types::{MediaItem, MediaKey, MediaType, ProviderId};
use std::collections::BTreeMap;

// The library change a merge makes, built before anything is written.
#[derive(Debug, Clone, PartialEq)]
pub struct MergePlan {
    pub entry: LibraryEntry,
    pub tombstone: Tombstone,
}

// One side of a merge: the user's data and when it last changed.
#[derive(Debug, Clone, Copy)]
pub struct Side<'a> {
    pub user: &'a UserData,
    pub updated_at: &'a str,
}

// Catalog length wins; saved catalog fields fill its blanks before manual fields.
pub fn merge_user(
    media_type: MediaType,
    manual: Side,
    existing: Option<Side>,
    catalog: &Length,
) -> Result<UserData, String> {
    let (newer, older) = match existing {
        Some(e) if e.updated_at > manual.updated_at => (e, Some(manual)),
        Some(e) => (manual, Some(e)),
        None => (manual, None),
    };
    let old = older.map(|s| s.user);
    let saved = existing.map_or(manual.user.length, |e| {
        fill(&e.user.length, &manual.user.length)
    });
    let mut user = UserData {
        status: old.map_or(newer.user.status, |o| status(newer.user.status, o.status)),
        progress: old.map_or(0, |o| o.progress).max(newer.user.progress),
        rating: newer.user.rating.or(old.and_then(|o| o.rating)),
        review: newer
            .user
            .review
            .clone()
            .or(old.and_then(|o| o.review.clone())),
        length: fill(catalog, &saved),
        plan: newer.user.plan.clone().or(old.and_then(|o| o.plan.clone())),
    };
    cap_progress(media_type, &mut user);
    Ok(user)
}

// Each length field the first side has, else the second's.
fn fill(first: &Length, second: &Length) -> Length {
    Length {
        runtime_minutes: first.runtime_minutes.or(second.runtime_minutes),
        episodes: first.episodes.or(second.episodes),
        episode_minutes: first.episode_minutes.or(second.episode_minutes),
        chapters: first.chapters.or(second.chapters),
        chapter_minutes: first.chapter_minutes.or(second.chapter_minutes),
        pages: first.pages.or(second.pages),
        hours: first.hours.or(second.hours),
    }
}

// Further along wins; Dropped loses to an active status and ties Planning, where the newer side wins.
fn status(newer: Status, older: Status) -> Status {
    let rank = |s: Status| match s {
        Status::Planning | Status::Dropped => 0,
        Status::InProgress => 1,
        Status::Completed => 2,
    };
    if rank(older) > rank(newer) {
        older
    } else {
        newer
    }
}

// The length field progress counts against; a movie is only watched or not.
fn total(media_type: MediaType, length: &Length) -> Option<u32> {
    match media_type {
        MediaType::Movie => None,
        MediaType::Tv | MediaType::Anime => length.episodes,
        MediaType::Manga => length.chapters,
        MediaType::Book => length.pages,
        MediaType::Game => length.hours,
    }
}

// Progress beyond the winning total finishes at that total.
fn cap_progress(media_type: MediaType, user: &mut UserData) {
    if let Some(n) = total(media_type, &user.length) {
        if user.progress > n {
            user.progress = n;
            user.status = Status::Completed;
        }
    }
}

// Checks a manual item can become `item` and builds the merged entry plus its tombstone.
pub fn plan_merge(
    file: &LibraryFile,
    from: &str,
    item: &MediaItem,
    catalog: &Length,
    at: &str,
) -> Result<MergePlan, String> {
    let key = MediaKey::parse(from)?;
    if key.provider != ProviderId::Manual {
        return Err("only a manual item can be matched".into());
    }
    if file.merged.contains_key(from) {
        return Err("this item was already matched".into());
    }
    let manual = file
        .entries
        .get(from)
        .ok_or_else(|| format!("{from} is not in the library"))?;
    if item.provider == ProviderId::Manual {
        return Err("a match must come from a catalog".into());
    }
    if item.media_type != key.media_type {
        return Err("a match must be the same type".into());
    }
    let existing = file.entries.get(&item.media_key);
    let user = merge_user(key.media_type, side(manual), existing.map(side), catalog)?;
    validate_user_data(key.media_type, &user)?;
    let created_at = existing
        .map_or(&manual.created_at, |e| {
            (&e.created_at).min(&manual.created_at)
        })
        .clone();
    let entry = LibraryEntry {
        key: item.media_key.clone(),
        snapshot: existing.map_or_else(|| MediaSnapshot::from_item(item), |e| e.snapshot.clone()),
        user,
        created_at,
        updated_at: at.to_string(),
    };
    let tombstone = Tombstone {
        into: item.media_key.clone(),
        entry: manual.clone(),
        existing: existing.cloned(),
        at: at.to_string(),
    };
    Ok(MergePlan { entry, tombstone })
}

fn side(entry: &LibraryEntry) -> Side<'_> {
    Side {
        user: &entry.user,
        updated_at: &entry.updated_at,
    }
}

// Swaps the manual entry for the merged one and keeps the tombstone, in one in-memory step.
pub fn apply_merge(file: &mut LibraryFile, from: &str, plan: MergePlan) {
    file.entries.remove(from);
    file.entries.insert(plan.entry.key.clone(), plan.entry);
    file.merged.insert(from.to_string(), plan.tombstone);
}

// Puts the manual item (and a combined catalog entry) back; refused once the merged entry moved on.
pub fn unmerge(file: &mut LibraryFile, from: &str) -> Result<Tombstone, String> {
    let t = file.merged.get(from).ok_or("this item was not matched")?;
    let now = file
        .entries
        .get(&t.into)
        .ok_or("the matched item is no longer in the library")?;
    if now.updated_at != t.at {
        return Err("it changed after the match, so the match can't be undone".into());
    }
    let t = file
        .merged
        .remove(from)
        .ok_or("this item was not matched")?;
    file.entries.remove(&t.into);
    if let Some(before) = &t.existing {
        file.entries.insert(t.into.clone(), before.clone());
    }
    file.entries.insert(from.to_string(), t.entry.clone());
    Ok(t)
}

// Manual key → the key its history now lives under: a catalog match or a type change.
pub fn aliases(file: &LibraryFile) -> BTreeMap<String, String> {
    file.merged
        .iter()
        .map(|(from, t)| (from.clone(), t.into.clone()))
        .chain(
            file.retyped
                .iter()
                .map(|(from, into)| (from.clone(), into.clone())),
        )
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::types::Id;
    use crate::library::types::Plan;

    const MANUAL: &str = "manual:book:0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69";

    fn user(status: Status, progress: u32) -> UserData {
        UserData {
            status,
            progress,
            ..UserData::default()
        }
    }

    fn pages(n: u32) -> Length {
        Length {
            pages: Some(n),
            ..Length::default()
        }
    }

    fn plan(since: &str) -> Plan {
        Plan {
            days: vec![0],
            max_session_minutes: 30,
            since: since.into(),
        }
    }

    fn side<'a>(user: &'a UserData, at: &'a str) -> Side<'a> {
        Side {
            user,
            updated_at: at,
        }
    }

    fn book() -> MediaItem {
        MediaItem {
            release_date: Some("2020-09-15".into()),
            poster_path: Some("https://example.com/piranesi.jpg".into()),
            ..MediaItem::new(
                Id::Num(42),
                "Piranesi".into(),
                MediaType::Book,
                ProviderId::Itunes,
            )
        }
    }

    fn manual_entry(user: UserData, updated_at: &str) -> LibraryEntry {
        LibraryEntry {
            key: MANUAL.into(),
            snapshot: MediaSnapshot {
                media_key: MANUAL.into(),
                provider: ProviderId::Manual,
                media_type: MediaType::Book,
                title: "piranesi (typo)".into(),
                poster_path: None,
                poster_file: None,
                year: None,
                creator: Some("S. Clarke".into()),
                overview: Some("My own notes".into()),
                genres: vec!["Fantasy".into()],
                platforms: Vec::new(),
            },
            user,
            created_at: "2026-10-01T10:00:00Z".into(),
            updated_at: updated_at.into(),
        }
    }

    fn library(entries: Vec<LibraryEntry>) -> LibraryFile {
        LibraryFile {
            entries: entries.into_iter().map(|e| (e.key.clone(), e)).collect(),
            ..LibraryFile::default()
        }
    }

    #[test]
    fn aliases_follow_merges_and_type_changes() {
        let mut file = LibraryFile::default();
        file.retyped
            .insert("manual:book:1".into(), "manual:manga:1".into());
        assert_eq!(
            aliases(&file),
            BTreeMap::from([("manual:book:1".to_string(), "manual:manga:1".to_string())])
        );
    }

    #[test]
    fn the_catalogs_length_wins_and_the_manual_one_fills_its_blanks() {
        let mine = UserData {
            length: Length {
                chapters: Some(300),
                chapter_minutes: Some(22),
                ..Length::default()
            },
            ..user(Status::InProgress, 10)
        };
        let catalog = Length {
            chapters: Some(380),
            ..Length::default()
        };
        let out = merge_user(MediaType::Manga, side(&mine, "t1"), None, &catalog).unwrap();
        assert_eq!(out.length.chapters, Some(380));
        assert_eq!(out.length.chapter_minutes, Some(22));
    }

    #[test]
    fn a_typed_length_gives_way_to_the_catalogs() {
        let mine = UserData {
            length: Length {
                episodes: Some(300),
                ..Length::default()
            },
            ..user(Status::InProgress, 3)
        };
        let catalog = Length {
            episodes: Some(25),
            episode_minutes: Some(25),
            ..Length::default()
        };
        let out = merge_user(MediaType::Anime, side(&mine, "t1"), None, &catalog).unwrap();
        assert_eq!(out.length, catalog);
        assert_eq!((out.status, out.progress), (Status::InProgress, 3));
    }

    #[test]
    fn the_users_own_fields_survive_a_plain_merge() {
        let mine = UserData {
            rating: Some(8),
            review: Some("Loved the house".into()),
            plan: Some(plan("2026-10-01")),
            ..user(Status::InProgress, 120)
        };
        let out = merge_user(MediaType::Book, side(&mine, "t1"), None, &pages(320)).unwrap();
        assert_eq!(
            out,
            UserData {
                length: pages(320),
                ..mine
            }
        );
    }

    #[test]
    fn progress_past_the_catalogs_length_stops_at_the_end_and_finishes_it() {
        let mine = UserData {
            length: pages(400),
            ..user(Status::InProgress, 380)
        };
        let out = merge_user(MediaType::Book, side(&mine, "t1"), None, &pages(320)).unwrap();
        assert_eq!(
            (out.status, out.progress, out.length.pages),
            (Status::Completed, 320, Some(320))
        );
    }

    #[test]
    fn progress_within_the_length_keeps_its_status() {
        let mine = user(Status::InProgress, 320);
        let out = merge_user(MediaType::Book, side(&mine, "t1"), None, &pages(320)).unwrap();
        assert_eq!((out.status, out.progress), (Status::InProgress, 320));
    }

    #[test]
    fn a_movie_has_no_length_to_cap_against() {
        let mine = user(Status::Completed, 1);
        let runtime = Length {
            runtime_minutes: Some(116),
            ..Length::default()
        };
        let out = merge_user(MediaType::Movie, side(&mine, "t1"), None, &runtime).unwrap();
        assert_eq!((out.status, out.progress), (Status::Completed, 1));
    }

    #[test]
    fn combining_keeps_the_most_advanced_status_and_progress() {
        let mine = user(Status::InProgress, 50);
        let theirs = user(Status::Completed, 20);
        let out = merge_user(
            MediaType::Book,
            side(&mine, "t2"),
            Some(side(&theirs, "t1")),
            &Length::default(),
        )
        .unwrap();
        assert_eq!((out.status, out.progress), (Status::Completed, 50));
    }

    #[test]
    fn combining_keeps_the_older_sides_progress_when_it_is_further() {
        let mine = user(Status::InProgress, 10);
        let theirs = user(Status::InProgress, 90);
        let out = merge_user(
            MediaType::Book,
            side(&mine, "t2"),
            Some(side(&theirs, "t1")),
            &Length::default(),
        )
        .unwrap();
        assert_eq!(out.progress, 90);
    }

    #[test]
    fn dropped_loses_to_an_active_status_whichever_side_is_newer() {
        for (a, b) in [
            (Status::Dropped, Status::InProgress),
            (Status::InProgress, Status::Dropped),
        ] {
            let (mine, theirs) = (user(a, 0), user(b, 0));
            let out = merge_user(
                MediaType::Book,
                side(&mine, "t9"),
                Some(side(&theirs, "t1")),
                &Length::default(),
            )
            .unwrap();
            assert_eq!(out.status, Status::InProgress, "{a:?} + {b:?}");
        }
    }

    #[test]
    fn dropped_against_planning_follows_the_newer_side() {
        let (dropped, planning) = (user(Status::Dropped, 0), user(Status::Planning, 0));
        let newer_dropped = merge_user(
            MediaType::Book,
            side(&dropped, "t2"),
            Some(side(&planning, "t1")),
            &Length::default(),
        )
        .unwrap();
        assert_eq!(newer_dropped.status, Status::Dropped);
        let newer_planning = merge_user(
            MediaType::Book,
            side(&dropped, "t1"),
            Some(side(&planning, "t2")),
            &Length::default(),
        )
        .unwrap();
        assert_eq!(newer_planning.status, Status::Planning);
    }

    #[test]
    fn combining_keeps_a_rating_only_one_side_has() {
        let mine = user(Status::Planning, 0);
        let theirs = UserData {
            rating: Some(7),
            ..user(Status::Planning, 0)
        };
        let out = merge_user(
            MediaType::Book,
            side(&mine, "t9"),
            Some(side(&theirs, "t1")),
            &Length::default(),
        )
        .unwrap();
        assert_eq!(out.rating, Some(7));
    }

    #[test]
    fn combining_takes_the_newer_sides_rating_review_and_plan() {
        let old = UserData {
            rating: Some(4),
            review: Some("old".into()),
            plan: Some(plan("2026-01-01")),
            ..user(Status::Planning, 0)
        };
        let new = UserData {
            rating: Some(9),
            review: Some("new".into()),
            plan: Some(plan("2026-10-01")),
            ..user(Status::Planning, 0)
        };
        for (mine, mine_at, theirs, theirs_at) in
            [(&new, "t2", &old, "t1"), (&old, "t1", &new, "t2")]
        {
            let out = merge_user(
                MediaType::Book,
                side(mine, mine_at),
                Some(side(theirs, theirs_at)),
                &Length::default(),
            )
            .unwrap();
            assert_eq!(out.rating, Some(9));
            assert_eq!(out.review.as_deref(), Some("new"));
            assert_eq!(out.plan, Some(plan("2026-10-01")));
        }
    }

    #[test]
    fn combining_takes_the_catalog_then_the_saved_entry_then_the_manual_one() {
        let mine = UserData {
            length: Length {
                pages: Some(500),
                hours: Some(12),
                runtime_minutes: Some(90),
                ..Length::default()
            },
            ..user(Status::Planning, 0)
        };
        let saved = UserData {
            length: Length {
                pages: Some(410),
                hours: Some(9),
                ..Length::default()
            },
            ..user(Status::Planning, 0)
        };
        for (mine_at, saved_at) in [("t2", "t1"), ("t1", "t2")] {
            let out = merge_user(
                MediaType::Book,
                side(&mine, mine_at),
                Some(side(&saved, saved_at)),
                &pages(320),
            )
            .unwrap();
            assert_eq!(
                (
                    out.length.pages,
                    out.length.hours,
                    out.length.runtime_minutes
                ),
                (Some(320), Some(9), Some(90)),
                "mine at {mine_at}"
            );
        }
    }

    #[test]
    fn a_plain_merge_moves_the_item_under_the_catalog_key() {
        let mine = UserData {
            rating: Some(8),
            ..user(Status::InProgress, 120)
        };
        let file = library(vec![manual_entry(mine.clone(), "2026-10-02T09:00:00Z")]);
        let plan = plan_merge(&file, MANUAL, &book(), &pages(320), "2026-10-19T12:00:00Z").unwrap();
        assert_eq!(plan.entry.key, "itunes:book:42");
        assert_eq!(plan.entry.snapshot, MediaSnapshot::from_item(&book()));
        assert_eq!(
            plan.entry.user,
            UserData {
                length: pages(320),
                ..mine
            }
        );
        assert_eq!(plan.entry.created_at, "2026-10-01T10:00:00Z");
        assert_eq!(plan.entry.updated_at, "2026-10-19T12:00:00Z");
        assert_eq!(
            plan.tombstone,
            Tombstone {
                into: "itunes:book:42".into(),
                entry: file.entries[MANUAL].clone(),
                existing: None,
                at: "2026-10-19T12:00:00Z".into(),
            }
        );
    }

    #[test]
    fn a_combine_keeps_the_saved_catalog_entry_and_remembers_it() {
        let saved = LibraryEntry {
            key: "itunes:book:42".into(),
            snapshot: MediaSnapshot {
                poster_file: Some("itunes_book_42.jpg".into()),
                ..MediaSnapshot::from_item(&book())
            },
            user: user(Status::Completed, 0),
            created_at: "2026-09-01T08:00:00Z".into(),
            updated_at: "2026-09-02T08:00:00Z".into(),
        };
        let file = library(vec![
            manual_entry(user(Status::InProgress, 30), "2026-10-02T09:00:00Z"),
            saved.clone(),
        ]);
        let plan = plan_merge(&file, MANUAL, &book(), &Length::default(), "t9").unwrap();
        assert_eq!(plan.entry.snapshot, saved.snapshot);
        assert_eq!(
            (plan.entry.user.status, plan.entry.user.progress),
            (Status::Completed, 30)
        );
        assert_eq!(plan.entry.created_at, "2026-09-01T08:00:00Z");
        assert_eq!(plan.tombstone.existing, Some(saved));
    }

    #[test]
    fn a_merge_is_refused_for_anything_but_a_saved_manual_item_of_the_same_type() {
        let file = library(vec![manual_entry(UserData::default(), "t1")]);
        let mut done = file.clone();
        done.entries.clear();
        done.merged.insert(
            MANUAL.into(),
            Tombstone {
                into: "itunes:book:42".into(),
                entry: file.entries[MANUAL].clone(),
                existing: None,
                at: "t2".into(),
            },
        );
        let movie = MediaItem::new(
            Id::Num(1),
            "Piranesi".into(),
            MediaType::Movie,
            ProviderId::Tmdb,
        );
        let manual_match = MediaItem::new(
            Id::Str("x".into()),
            "Piranesi".into(),
            MediaType::Book,
            ProviderId::Manual,
        );
        let none = Length::default();
        let cases: [(&LibraryFile, &str, &MediaItem, &str); 5] = [
            (
                &file,
                "itunes:book:42",
                &book(),
                "only a manual item can be matched",
            ),
            (
                &file,
                "manual:book:missing",
                &book(),
                "manual:book:missing is not in the library",
            ),
            (&done, MANUAL, &book(), "this item was already matched"),
            (&file, MANUAL, &movie, "a match must be the same type"),
            (
                &file,
                MANUAL,
                &manual_match,
                "a match must come from a catalog",
            ),
        ];
        for (f, from, item, want) in cases {
            assert_eq!(
                plan_merge(f, from, item, &none, "t3").unwrap_err(),
                want,
                "{from}"
            );
        }
    }

    fn merged(file: &LibraryFile, at: &str) -> LibraryFile {
        let mut out = file.clone();
        let plan = plan_merge(file, MANUAL, &book(), &pages(320), at).unwrap();
        apply_merge(&mut out, MANUAL, plan);
        out
    }

    #[test]
    fn applying_a_merge_swaps_the_entries_and_keeps_the_tombstone() {
        let file = library(vec![manual_entry(user(Status::InProgress, 3), "t1")]);
        let out = merged(&file, "t2");
        assert_eq!(out.entries.keys().collect::<Vec<_>>(), ["itunes:book:42"]);
        assert_eq!(out.merged[MANUAL].entry, file.entries[MANUAL]);
        assert_eq!(
            aliases(&out),
            [(MANUAL.to_string(), "itunes:book:42".to_string())].into()
        );
    }

    #[test]
    fn undoing_a_plain_merge_restores_the_file_exactly() {
        let file = library(vec![manual_entry(user(Status::InProgress, 3), "t1")]);
        let mut out = merged(&file, "t2");
        let t = unmerge(&mut out, MANUAL).unwrap();
        assert_eq!(t.into, "itunes:book:42");
        assert_eq!(out, file);
    }

    #[test]
    fn undoing_a_combine_puts_the_saved_catalog_entry_back_too() {
        let saved = LibraryEntry {
            key: "itunes:book:42".into(),
            snapshot: MediaSnapshot::from_item(&book()),
            user: user(Status::Completed, 0),
            created_at: "t0".into(),
            updated_at: "t0".into(),
        };
        let file = library(vec![manual_entry(user(Status::InProgress, 3), "t1"), saved]);
        let mut out = merged(&file, "t2");
        assert_eq!(out.entries.len(), 1);
        unmerge(&mut out, MANUAL).unwrap();
        assert_eq!(out, file);
    }

    #[test]
    fn undo_is_refused_once_the_catalog_entry_changed_or_left() {
        let file = library(vec![manual_entry(user(Status::InProgress, 3), "t1")]);
        let mut changed = merged(&file, "t2");
        changed
            .entries
            .get_mut("itunes:book:42")
            .unwrap()
            .updated_at = "t3".into();
        let mut gone = merged(&file, "t2");
        gone.entries.clear();
        for (mut f, want) in [
            (
                changed,
                "it changed after the match, so the match can't be undone",
            ),
            (gone, "the matched item is no longer in the library"),
            (file.clone(), "this item was not matched"),
        ] {
            let before = f.clone();
            assert_eq!(unmerge(&mut f, MANUAL).unwrap_err(), want);
            assert_eq!(f, before, "a refused undo changes nothing");
        }
    }
}
