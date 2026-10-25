import { describe, expect, it, vi } from "vitest";
import { UnlocksStore } from "./unlocks.svelte";
import { PrefsStore } from "./prefs.svelte";
import { DEFAULT_PREFS, type PrefsPatch } from "$lib/types/prefs";
import { PROFILE_ART } from "$lib/domain/profileArt";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function entries(count: number, type: MediaType = "movie"): LibraryEntry[] {
  return Array.from({ length: count }, (_, i) => {
    const key = `manual:${type}:${i}`;
    return {
      key,
      snapshot: {
        media_key: key,
        provider: "manual",
        media_type: type,
        title: `Story ${i}`,
        year: null,
        poster_path: null,
        poster_file: null,
      },
      user: {
        status: "completed",
        progress: 1,
        length: emptyLength(),
        rating: null,
        review: null,
        plan: null,
      },
      created_at: "2026-10-01",
      updated_at: "2026-10-01",
    };
  });
}
function setup(selected = "movie:1") {
  let level: number | null = 50;
  let collection: LibraryEntry[] | null = entries(50);
  let saved = { ...DEFAULT_PREFS, profile_art: selected, seen_level: 99 };
  const update = vi.fn(async (patch: PrefsPatch) => (saved = { ...saved, ...patch }));
  const prefs = new PrefsStore({ load: async () => saved, update });
  prefs.prefs = saved;
  prefs.ready = prefs.loaded = true;
  const equipment = new UnlocksStore(
    prefs,
    () => level,
    () => collection,
  );
  return {
    prefs,
    equipment,
    update,
    level: (value: number | null) => {
      level = value;
    },
    collection: (value: LibraryEntry[] | null) => {
      collection = value;
    },
  };
}

describe("current completion artwork eligibility", () => {
  it.each(PROFILE_ART)(
    "requires both current boundaries for $id, without repairing preferences",
    async (art) => {
      const s = setup(art.id);
      s.collection(entries(art.required, art.type));
      s.level(art.level - 1);
      expect(s.equipment.profileArt).toBe("default");
      expect(s.equipment.canEquipArt(art.id)).toBe(false);
      expect(await s.equipment.equipArt(art.id)).toBe(false);
      s.level(art.level);
      s.collection(entries(art.required - 1, art.type));
      expect(s.equipment.profileArt).toBe("default");
      expect(s.equipment.canEquipArt(art.id)).toBe(false);
      s.collection(entries(art.required, art.type));
      expect(s.equipment.profileArt).toBe(art.id);
      expect(s.equipment.canEquipArt(art.id)).toBe(true);
      expect(s.equipment.artRewards.find((a) => a.id === art.id)).toMatchObject({
        count: art.required,
        unlocked: true,
      });
      expect(s.update).not.toHaveBeenCalled();
      expect(s.prefs.prefs.profile_art).toBe(art.id);
    },
  );

  it("does not treat duplicate keys or other media completions as requirements", () => {
    const s = setup("movie:5");
    const one = entries(1)[0];
    s.collection([...Array(10).fill(one), ...entries(50, "book")]);
    expect(s.equipment.profileArt).toBe("default");
    expect(s.equipment.artRewards.find((a) => a.id === "movie:5")?.count).toBe(1);
  });
  it("invalidates unknown authority, prefs failure, uncompletion and removal then recovers", () => {
    const s = setup();
    s.collection(entries(1));
    expect(s.equipment.profileArt).toBe("movie:1");
    s.level(null);
    expect(s.equipment.profileArt).toBe("default");
    s.level(50);
    s.collection(null);
    expect(s.equipment.profileArt).toBe("default");
    s.collection(entries(1));
    s.prefs.loaded = false;
    expect(s.equipment.profileArt).toBe("default");
    s.prefs.loaded = true;
    const incomplete = entries(1);
    incomplete[0].user.status = "planning";
    s.collection(incomplete);
    expect(s.equipment.profileArt).toBe("default");
    s.collection([]);
    expect(s.equipment.profileArt).toBe("default");
    s.collection(entries(1));
    expect(s.equipment.profileArt).toBe("movie:1");
    expect(s.update).not.toHaveBeenCalled();
  });
  it("saves only valid earned IDs, supports clearing and preserves unknown saved selections", async () => {
    const s = setup("future:1");
    expect(s.equipment.profileArt).toBe("default");
    expect(await s.equipment.equipArt("unknown:1")).toBe(false);
    expect(s.prefs.prefs.profile_art).toBe("future:1");
    expect(await s.equipment.equipArt("movie:1")).toBe(true);
    expect(s.update).toHaveBeenCalledWith({ profile_art: "movie:1" });
    expect(s.equipment.profileArt).toBe("movie:1");
    expect(await s.equipment.equipArt("default")).toBe(true);
    expect(s.equipment.profileArt).toBe("default");
    s.prefs.loaded = false;
    expect(await s.equipment.equipArt("default")).toBe(false);
  });
  it("rolls back a failed native save to the previous effective art", async () => {
    const s = setup();
    s.update.mockRejectedValueOnce(new Error("Disk full"));
    expect(await s.equipment.equipArt("movie:5")).toBe(false);
    expect(s.equipment.profileArt).toBe("movie:1");
    expect(s.prefs.prefs.profile_art).toBe("movie:1");
    expect(s.prefs.error).toContain("Disk full");
  });
});
