import { afterEach, describe, expect, it, vi } from "vitest";
import { morphKey, posterKey, startTransition } from "./transition";

const detail = (type: string, id: string) => ({
  route: { id: "/media/[type]/[id]" },
  params: { type, id },
});
const home = { route: { id: "/" }, params: {} };

function poster(key: string) {
  const img = document.createElement("img");
  img.dataset.poster = key;
  document.body.append(img);
  return img;
}

// A fake engine: snapshots the old state, runs the update, then finishes.
function engine() {
  const seen: { before: string; after: string; shown?: string[] }[] = [];
  const skip = vi.fn();
  const start = vi.fn((update: () => Promise<void>) => {
    const names = () =>
      [...document.querySelectorAll<HTMLElement>("[data-poster]")]
        .map((el) => el.style.viewTransitionName)
        .join(",");
    const before = names();
    const finished = update().then(() => {
      const shown = [...document.querySelectorAll<HTMLElement>("[data-poster]")].map(
        (el) => (el.parentElement as HTMLElement).style.contentVisibility,
      );
      seen.push({ before, after: names(), shown });
    });
    return { finished, skipTransition: skip };
  });
  const doc = {
    startViewTransition: start,
    querySelectorAll: document.querySelectorAll.bind(document),
  } as unknown as Document;
  return { start, seen, doc, skip };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe("morphKey", () => {
  it("names the item when opening or leaving a detail page", () => {
    expect(morphKey({ from: home, to: detail("movie", "7") })).toBe("movie/7");
    expect(morphKey({ from: detail("anime", "a:b"), to: home })).toBe("anime/a:b");
  });

  it("is null between other pages", () => {
    expect(morphKey({ from: home, to: { route: { id: "/library" }, params: {} } })).toBeNull();
    expect(morphKey({ from: null, to: null })).toBeNull();
  });
});

describe("startTransition", () => {
  type Place = { route: { id: string }; params: Partial<Record<string, string>> };
  const nav = (from: Place = home, to: Place = detail("movie", "7")) => ({
    from,
    to,
    complete: Promise.resolve(),
  });

  it("does nothing without the API", () => {
    const doc = { querySelectorAll: document.querySelectorAll.bind(document) } as Document;
    expect(startTransition(nav(), { motion: true, doc })).toBeUndefined();
  });

  it("does nothing with Animations off", () => {
    const { start, doc } = engine();
    expect(startTransition(nav(), { motion: false, doc })).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  });

  it("does nothing between pages that share no poster", () => {
    const { start, doc } = engine();
    const tabs = nav(home, { route: { id: "/library" }, params: {} });
    expect(startTransition(tabs, { motion: true, doc })).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  });

  it("does nothing when the page being left shows no poster for the item", () => {
    const { start, doc } = engine();
    expect(startTransition(nav(), { motion: true, doc })).toBeUndefined();
    expect(start).not.toHaveBeenCalled();
  });

  it("skips a morph still playing when the next navigation starts", async () => {
    const { skip, doc } = engine();
    poster(posterKey("movie", "7"));
    const never = { from: home, to: detail("movie", "7"), complete: new Promise<void>(() => {}) };
    await startTransition(never, { motion: true, doc });
    startTransition(nav(detail("movie", "7"), home), { motion: true, doc });
    expect(skip).toHaveBeenCalledOnce();
  });

  it("hands the poster name from the card to the hero, then clears it", async () => {
    const { seen, doc } = engine();
    const card = poster(posterKey("movie", "7"));
    poster(posterKey("movie", "8"));
    let hero!: HTMLImageElement;
    const navigation = {
      from: home,
      to: detail("movie", "7"),
      complete: Promise.resolve().then(() => {
        card.remove();
        hero = poster(posterKey("movie", "7"));
      }),
    };

    await startTransition(navigation, { motion: true, doc });
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    expect(seen[0]).toMatchObject({ before: "poster,", after: ",poster" });
    expect(hero.style.viewTransitionName).toBe("");
  });

  it("waits for a late hero without animation frames, which the engine pauses mid-swap", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const { seen, doc } = engine();
    poster(posterKey("movie", "7"));
    const navigation = {
      from: home,
      to: detail("movie", "7"),
      complete: Promise.resolve().then(() => {
        document.body.replaceChildren();
        setTimeout(() => poster(posterKey("movie", "7")), 50);
      }),
    };

    await startTransition(navigation, { motion: true, doc });
    await vi.waitFor(() => expect(seen).toHaveLength(1), { timeout: 1000 });

    expect(seen[0].after).toBe("poster");
  });

  it("draws a card inside a skipped off-screen section while it is captured", async () => {
    const { seen, doc } = engine();
    const hero = poster(posterKey("movie", "7"));
    let slot!: HTMLElement;
    const navigation = {
      from: detail("movie", "7"),
      to: home,
      complete: Promise.resolve().then(() => {
        hero.remove();
        slot = document.createElement("div");
        slot.style.contentVisibility = "auto";
        slot.append(poster(posterKey("movie", "7")));
        document.body.append(slot);
      }),
    };

    await startTransition(navigation, { motion: true, doc });
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    expect(seen[0].shown).toEqual(["visible"]);
    expect(slot.style.contentVisibility).toBe("auto");
  });

  it("plays in reverse on Back: hero to the card", async () => {
    const { seen, doc } = engine();
    const hero = poster(posterKey("movie", "7"));
    const navigation = {
      from: detail("movie", "7"),
      to: home,
      complete: Promise.resolve().then(() => {
        hero.remove();
        poster(posterKey("movie", "6"));
        poster(posterKey("movie", "7"));
      }),
    };

    await startTransition(navigation, { motion: true, doc });
    await vi.waitFor(() => expect(seen).toHaveLength(1));

    expect(seen[0]).toMatchObject({ before: "poster", after: ",poster" });
  });
});
