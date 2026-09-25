import { describe, expect, it } from "vitest";
import {
  REQUIRED_LENGTH_FIELDS,
  emptyLength,
  isPlannable,
  lengthFromDetail,
  missingLengthFields,
  resolveTotal,
} from "./length";
import type { Length } from "$lib/types/library";
import type { MediaDetail } from "$lib/types/media";

const detail = (over: Partial<MediaDetail>): MediaDetail =>
  ({ media_type: "tv", ...over }) as MediaDetail;

const len = (over: Partial<Length> = {}): Length => ({ ...emptyLength(), ...over });

describe("REQUIRED_LENGTH_FIELDS", () => {
  it("names what each family needs to be plannable", () => {
    expect(REQUIRED_LENGTH_FIELDS.movie).toEqual(["runtime_minutes"]);
    expect(REQUIRED_LENGTH_FIELDS.tv).toEqual(["episodes", "episode_minutes"]);
    expect(REQUIRED_LENGTH_FIELDS.anime).toEqual(["episodes", "episode_minutes"]);
    expect(REQUIRED_LENGTH_FIELDS.manga).toEqual(["chapters", "chapter_minutes"]);
    expect(REQUIRED_LENGTH_FIELDS.book).toEqual(["pages"]);
    expect(REQUIRED_LENGTH_FIELDS.game).toEqual(["hours"]);
  });
});

describe("lengthFromDetail", () => {
  it("prefills a movie runtime", () => {
    expect(lengthFromDetail("movie", detail({ runtime: 148 })).runtime_minutes).toBe(148);
  });

  it("prefills episode and chapter counts", () => {
    expect(lengthFromDetail("tv", detail({ episodes: 24 })).episodes).toBe(24);
    expect(lengthFromDetail("manga", detail({ chapters: 139 })).chapters).toBe(139);
  });

  it("converts the RAWG playtime in minutes into whole hours", () => {
    expect(lengthFromDetail("game", detail({ runtime: 74 * 60 })).hours).toBe(74);
  });

  it("never invents minutes per episode, because no provider returns it", () => {
    expect(
      lengthFromDetail("tv", detail({ episodes: 24, runtime: 45 })).episode_minutes,
    ).toBeNull();
  });

  it("leaves a book empty, since no provider gives a page count", () => {
    expect(lengthFromDetail("book", detail({}))).toEqual(emptyLength());
  });

  it("treats a zero provider value as unknown", () => {
    expect(lengthFromDetail("game", detail({ runtime: 0 })).hours).toBeNull();
    expect(lengthFromDetail("movie", detail({ runtime: 0 })).runtime_minutes).toBeNull();
  });

  it("returns an empty length without a detail", () => {
    expect(lengthFromDetail("tv", null)).toEqual(emptyLength());
  });
});

describe("missingLengthFields / isPlannable", () => {
  it("lists only what is still missing", () => {
    expect(missingLengthFields("tv", len({ episodes: 24 }))).toEqual(["episode_minutes"]);
    expect(missingLengthFields("book", len({ pages: 350 }))).toEqual([]);
  });

  it("is plannable only when every required field is present", () => {
    expect(isPlannable("tv", len({ episodes: 24 }))).toBe(false);
    expect(isPlannable("tv", len({ episodes: 24, episode_minutes: 42 }))).toBe(true);
    expect(isPlannable("book", len({ pages: 350 }))).toBe(true);
    expect(isPlannable("book", emptyLength())).toBe(false);
  });

  it("ignores fields another family needs", () => {
    expect(isPlannable("book", len({ pages: 350, hours: 99 }))).toBe(true);
  });

  it("treats zero as missing, not as a length", () => {
    expect(isPlannable("book", len({ pages: 0 }))).toBe(false);
  });
});

describe("resolveTotal", () => {
  it("prefers the user's number over the provider's", () => {
    expect(resolveTotal("tv", detail({ episodes: 24 }), len({ episodes: 12 }))).toBe(12);
  });

  it("falls back to the provider when the user has not said", () => {
    expect(resolveTotal("tv", detail({ episodes: 24 }), emptyLength())).toBe(24);
  });

  it("gives a book a total only from the user", () => {
    expect(resolveTotal("book", detail({}), emptyLength())).toBeNull();
    expect(resolveTotal("book", detail({}), len({ pages: 350 }))).toBe(350);
  });

  it("uses the user's hours for a game", () => {
    expect(resolveTotal("game", detail({ runtime: 74 * 60 }), len({ hours: 120 }))).toBe(120);
  });

  it("keeps a movie at 1, which is watched or not", () => {
    expect(resolveTotal("movie", detail({ runtime: 148 }), len({ runtime_minutes: 148 }))).toBe(1);
  });

  it("works with no detail at all, as on a library card", () => {
    expect(resolveTotal("manga", null, len({ chapters: 41 }))).toBe(41);
  });
});
