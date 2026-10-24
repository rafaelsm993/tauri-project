import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures/tauri-ipc";
import { manualItem, mockLibrary } from "./fixtures/library";

// `chrome` is what the shared AppHeader should put on each screen. Content screens opt out:
// a detail page and the onboarding flow own their whole viewport, and their <h1> is the thing
// you came to read, not the name of a section.
const SCREENS = [
  { name: "home", path: "/", chrome: { heading: null } },
  { name: "detail", path: "/media/movie/1", chrome: null },
  { name: "library", path: "/library", chrome: { heading: "Library" } },
  { name: "profile", path: "/profile", chrome: { heading: "Profile" } },
  { name: "planner", path: "/planner", chrome: { heading: "Planner" } },
  { name: "welcome", path: "/welcome", chrome: null },
  { name: "settings", path: "/settings", chrome: { heading: "Settings" } },
];

for (const screen of SCREENS) {
  test.describe(`${screen.name} screen`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(screen.path);
      await page.waitForLoadState("networkidle");
    });

    test("has no horizontal page overflow", async ({ page }) => {
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, "page is wider than the viewport").toBeLessThanOrEqual(0);
    });

    test("carries no level chip: the Profile tab shows the level", async ({ page }) => {
      // The header is search and filters only. The level ring on the Profile tab is the one
      // place the level lives, so a chip here would be a second copy competing for the row.
      await expect(page.getByRole("link", { name: /^Level \d/ })).toHaveCount(0);
    });

    test("titles itself through the shared header", async ({ page }) => {
      // Home keeps <main> for its content column, so the header is a sibling there and a
      // child elsewhere: count the header itself rather than pinning it to a parent.
      const header = page.locator(".app-header");
      if (!screen.chrome) {
        await expect(header).toHaveCount(0);
        return;
      }
      await expect(header).toHaveCount(1);
      // Home is search-first and deliberately has no heading of its own.
      const heading = header.getByRole("heading", { level: 1 });
      if (screen.chrome.heading === null) {
        await expect(heading).toHaveCount(0);
        return;
      }
      await expect(heading).toHaveText(screen.chrome.heading);
    });
  });
}

test.describe("the library filters", () => {
  test("names each row, so two 'All' pills are not mistaken for one", async ({ page }) => {
    await mockLibrary(page, [
      manualItem("book", "Piranesi"),
      manualItem("movie", "Arrival"),
      manualItem("anime", "Frieren"),
    ]);
    await page.goto("/library");
    await page.waitForLoadState("networkidle");
    for (const name of ["Status", "Type", "View"]) {
      const group = page.getByRole("group", { name });
      const label = page.locator(".filter-label", { hasText: name });
      await expect(label).toBeVisible();
      const l = (await label.boundingBox())!;
      const g = (await group.boundingBox())!;
      expect(l.y + l.height, `${name} label is not above its row`).toBeLessThanOrEqual(g.y + 1);
      expect(g.y - (l.y + l.height), `${name} label is far from its row`).toBeLessThanOrEqual(8);
    }
  });

  test("keeps every filter option reachable without a sideways swipe", async ({ page }) => {
    await mockLibrary(page, [
      manualItem("book", "Piranesi"),
      manualItem("movie", "Arrival"),
      manualItem("anime", "Frieren"),
      manualItem("game", "Outer Wilds"),
    ]);
    await page.goto("/library");
    await page.waitForLoadState("networkidle");

    // Status hid 217px of its options on a 360px phone and Type hid 19px, so options like
    // "Completed" and "Dropped" were unreachable without a swipe nothing signposted.
    for (const label of ["Status", "Type", "View"]) {
      const group = page.getByRole("group", { name: label });
      await expect(group).toBeVisible();
      const hidden = await group.evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(hidden, `${label} hides options behind a scroll`).toBeLessThanOrEqual(1);
    }
    for (const name of [/^All/, /^Planning/, /^In progress/, /^Completed/, /^Dropped/]) {
      await expect(
        page.getByRole("group", { name: "Status" }).getByRole("button", { name }),
      ).toBeInViewport();
    }
  });
});

test.describe("the browse header", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  // Android draws the app under its status bar and reports that bar's height through
  // env(safe-area-inset-top); Chromium here reports 0. Fake the Galaxy A34's 27px.
  const fakeStatusBar = (page: Page) =>
    page.evaluate(() => document.documentElement.style.setProperty("--safe-top", "27px"));

  test("pins below the status bar with a little air, and paints that air", async ({ page }) => {
    await fakeStatusBar(page);
    await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
    const header = page.locator(".app-header");
    await expect.poll(async () => Math.round((await header.boundingBox())!.y)).toBe(35);
    // Whatever sits at the very top edge must be the header's own band, not scrolled content.
    const covered = await page.evaluate(() => {
      const h = document.querySelector(".app-header")!;
      const r = h.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, 2);
      return !!hit && h.contains(hit);
    });
    expect(covered, "content shows under the status bar").toBe(true);
  });

  test("rests where it pins, so it never lands on the content below", async ({ page }) => {
    await fakeStatusBar(page);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    const gap = await page.evaluate(() => {
      const h = document.querySelector(".app-header")!;
      const next = h.nextElementSibling as HTMLElement;
      return Math.round(next.getBoundingClientRect().top - h.getBoundingClientRect().bottom);
    });
    expect(gap, "the header overlaps the content under it").toBeGreaterThanOrEqual(0);
    // At rest the status bar shows the app's background art, not a painted band.
    const banded = await page.evaluate(() => {
      const h = document.querySelector(".app-header")!;
      const hit = document.elementFromPoint(h.getBoundingClientRect().left + 10, 2);
      return !!hit && h.contains(hit);
    });
    expect(banded).toBe(false);
  });

  test("steps the filters aside on the way down and brings them back on the way up", async ({
    page,
  }) => {
    const tabs = page.getByRole("button", { name: "Movies" });
    const search = page.getByRole("searchbox", { name: "Search the catalog" });
    await expect(tabs).toBeVisible();

    await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
    await expect(tabs).toBeHidden();
    // Search is the one control that must survive the whole scroll.
    await expect(search).toBeInViewport();

    await page.evaluate(() => scrollTo({ top: 1100, behavior: "instant" }));
    await expect(tabs).toBeVisible();
  });

  test("still steps the filters aside with animations off", async ({ page }) => {
    // The phone this shipped to has Animations off. Hiding a row in one step is not motion,
    // and gating it left a 44%-of-screen header pinned for the whole scroll.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.reload();
    await page.waitForLoadState("networkidle");
    const tabs = page.getByRole("button", { name: "Movies" });
    await expect(tabs).toBeVisible();

    await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
    await expect(tabs).toBeHidden();

    await page.evaluate(() => scrollTo({ top: 1100, behavior: "instant" }));
    await expect(tabs).toBeVisible();
  });

  test("a tap in the collapsed gap reaches the content showing through it", async ({ page }) => {
    // The hidden rows keep their box so the page never jumps; that box must not swallow taps
    // meant for the cards scrolled underneath.
    await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
    await expect(page.getByRole("button", { name: "Movies" })).toBeHidden();
    const reached = await page.evaluate(() => {
      const header = document.querySelector(".app-header")!;
      const gap = header.querySelector(".collapsible")!.getBoundingClientRect();
      const hit = document.elementFromPoint(gap.left + gap.width / 2, gap.top + gap.height / 2);
      return !!hit && !header.contains(hit);
    });
    expect(reached, "the collapsed header still catches taps").toBe(true);
  });

  test("collapsing never moves the page under you", async ({ page }) => {
    // Shrinking the header instead of hiding it reflows everything below: cards move mid-tap,
    // scroll restoration misses, and the shifted scrollY flips the collapse straight back so the
    // header will not come down again. Measured document-relative, because lazily loaded rails
    // change the page's total height on their own and would mask the header's contribution.
    const contentTop = () =>
      page.evaluate(() => (document.querySelector(".page-body") as HTMLElement).offsetTop);
    // Wait for the filters to be laid out before measuring, or the baseline is read while the
    // header is still short and matches the collapsed height by accident.
    const tabs = page.getByRole("button", { name: "Movies" });
    await expect(tabs).toBeVisible();
    const expanded = await contentTop();
    expect(expanded).toBeGreaterThan(0);

    await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
    await expect(tabs).toBeHidden();

    expect(await contentTop(), "the header changed size and pushed the page").toBe(expanded);
    expect(await page.evaluate(() => Math.round(scrollY))).toBe(1400);
  });
});

test.describe("touch devices", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
  });

  test("reward chips are at least 44px tall on coarse pointers", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    await mockLibrary(page, [], { seenLevel: 25 });
    await page.goto("/profile");
    const chips = page.getByRole("group", { name: "Accent" }).getByRole("button");
    await expect(chips.first()).toBeVisible();
    const heights = await chips.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    );
    expect(heights.length).toBeGreaterThan(1);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("category tabs are at least 44px tall on coarse pointers", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    const heights = await page
      .getByRole("navigation", { name: "Categories" })
      .getByRole("button")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights.length).toBe(6);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
  });

  test("the detail page Back button is touch-sized", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    await page.goto("/media/movie/1");
    const box = (await page.getByRole("button", { name: "Back", exact: true }).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  });

  test("phones skip the floating background shapes", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports keep the shapes");
    const floating = await page
      .locator(".circles li")
      .evaluateAll((els) =>
        els.flatMap((el) => el.getAnimations()).filter((a) => a.playState === "running"),
      );
    expect(floating.length).toBe(0);
  });

  test("shows every category at once, with nothing behind a scroll", async ({ page }) => {
    // The rail used to hide 310px of 513px on a 384px phone: four of the six were unreachable
    // without a sideways swipe nothing signposted.
    const rail = page.getByRole("navigation", { name: "Categories" });
    const hidden = await rail.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(hidden, "a category is hidden behind a scroll").toBeLessThanOrEqual(1);
    for (const name of ["Movies", "TV Shows", "Anime", "Manga", "Books", "Games"]) {
      await expect(page.getByRole("button", { name })).toBeInViewport();
    }
  });

  test("every category tab is reachable (fits or scrolls horizontally)", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Categories" });
    const ok = await nav.evaluate((el) => {
      const s = getComputedStyle(el);
      return el.scrollWidth <= el.clientWidth || ["auto", "scroll"].includes(s.overflowX);
    });
    expect(ok, "tabs overflow their nav and can't be scrolled to").toBe(true);
  });

  test("home content column is not collapsed in the stacked layout", async ({ page }) => {
    const height = await page.getByRole("main").evaluate((el) => el.getBoundingClientRect().height);
    expect(height, "main column collapsed to 0 px and clips its content").toBeGreaterThan(0);
  });

  test("genre filter sits beside the search field and hides during search", async ({
    page,
    isMobile,
  }) => {
    const nav = page.getByRole("navigation", { name: "Categories" });
    const trigger = page.getByRole("button", { name: /^Genres/ });
    await expect(trigger).toBeVisible();
    expect(await nav.getByRole("button").count()).toBe(6);
    // It used to sit inside the category bar behind a divider, where it ate 31% of a 320px bar
    // and pushed four of the six categories out of sight. It now shares the search row, which
    // also keeps it on screen when the filters collapse.
    const placed = await trigger.evaluate((t) => ({
      inCategoryBar: t.closest(".category-bar") !== null,
      inHeaderRow: t.closest(".app-header .row") !== null,
    }));
    expect(placed.inCategoryBar, "trigger is still in the category bar").toBe(false);
    expect(placed.inHeaderRow, "trigger is not in the header's persistent row").toBe(true);
    if (isMobile) expect((await trigger.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const barRight = await nav.evaluate((n) => n.getBoundingClientRect().right);
    expect(barRight, "category bar is wider than the viewport").toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );

    await page.getByRole("searchbox", { name: "Search the catalog" }).fill("test");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Results for", { exact: false })).toBeVisible();
    await expect(trigger).toHaveCount(0);

    await page.getByRole("button", { name: "← Discover" }).click();
    await expect(page.getByRole("button", { name: /^Genres/ })).toBeVisible();
  });

  test("hovering the genre filter does not move it", async ({ page }) => {
    const trigger = page.getByRole("button", { name: /^Genres/ });
    await expect(trigger).toBeVisible();
    const before = (await trigger.boundingBox())!;
    await trigger.hover();
    await page.waitForTimeout(400);
    const after = (await trigger.boundingBox())!;
    expect(Math.round(after.x)).toBe(Math.round(before.x));
    expect(Math.round(after.y)).toBe(Math.round(before.y));
  });

  test("picking genres shows only those carousels", async ({ page }) => {
    const viewport = page.viewportSize()!;
    const headings = page.getByRole("main").getByRole("heading", { level: 2 });
    await expect(headings).toHaveCount(19);

    await page.getByRole("button", { name: /^Genres/ }).click();
    const group = page.getByRole("group", { name: "Genres" });
    await expect(group).toBeVisible();
    // The popover animates open, so a single measurement can land mid-transition and read a
    // geometry the user never sees. Poll until the box stops moving, then assert on it.
    const box = () =>
      group.evaluate((g) => {
        const r = g.closest("[popover]")!.getBoundingClientRect();
        return { left: r.left, right: r.right, bottom: r.bottom };
      });
    let last = await box();
    await expect
      .poll(async () => {
        const now = await box();
        const settled = JSON.stringify(now) === JSON.stringify(last);
        last = now;
        return settled;
      })
      .toBe(true);
    const panel = last;
    expect(panel.left, "panel starts off-screen").toBeGreaterThanOrEqual(0);
    expect(panel.right, "panel ends off-screen").toBeLessThanOrEqual(viewport.width);
    expect(panel.bottom, "panel runs below the viewport").toBeLessThanOrEqual(viewport.height);

    await group.getByRole("checkbox", { name: "Western" }).check();
    await group.getByRole("checkbox", { name: "Comedy" }).check();
    await expect(page.getByRole("button", { name: /^Genres\s*2$/ })).toBeVisible();
    await expect(headings).toHaveText(["Comedy", "Western"]);

    await page.keyboard.press("Escape");
    await expect(group).toBeHidden();
    await expect(headings).toHaveText(["Comedy", "Western"]);
    await expect(
      page.getByRole("main").locator(".card__label-title", { hasText: "Test movie 1" }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /^Genres\s*2$/ }).click();
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(headings).toHaveCount(19);
  });

  test("carousels load lazily: first paint does not fetch every genre", async ({ page }) => {
    const calls = () =>
      page.evaluate(() => (window as unknown as { __ipcCalls: string[] }).__ipcCalls);
    const discover = async () => (await calls()).filter((c) => c === "catalog_page").length;
    const first = await discover();
    expect(first, "no carousel loaded").toBeGreaterThan(0);
    expect(first, "every carousel was fetched up front").toBeLessThan(19);

    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await expect.poll(discover).toBeGreaterThan(first);
  });

  test("back-to-top button appears after scrolling and is touch-sized", async ({
    page,
    isMobile,
  }) => {
    const button = page.getByRole("button", { name: "Back to top" });
    await expect(button).toHaveCount(0);

    await page.evaluate(() =>
      window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }),
    );
    await expect(button).toBeVisible();

    const box = await button.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box, "button has no layout box").not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    if (isMobile) {
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await button.click();
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
    await expect(button).toHaveCount(0);
  });

  test("card details are visible without hover", async ({ page, isMobile }) => {
    test.skip(!isMobile, "hover reveal is fine on mouse devices");
    const opacity = await page
      .locator(".card__overlay")
      .first()
      .evaluate((el) => getComputedStyle(el).opacity);
    expect(opacity).toBe("1");
  });

  test("the poster carries only the type and rating; a missing poster shows its title once", async ({
    page,
  }) => {
    const card = page.locator(".card").first();
    await expect(card.locator(".card__overview, .card__overlay-title")).toHaveCount(0);
    await expect(card.locator(".card__score")).toHaveText("★ 7.4");
    await expect(card.locator(".card__no-poster .placeholder__caption")).toBeVisible();
  });
});

test.describe("add manually", () => {
  // The tablet project has a coarse pointer too, so these run there and on both phones.
  test("every Add manually button is touch-sized", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mouse viewports may use compact targets");
    for (const path of ["/library", "/planner"]) {
      await page.goto(path);
      const box = (await page.getByRole("button", { name: "Add manually" }).boundingBox())!;
      expect(box.height, path).toBeGreaterThanOrEqual(44);
      expect(box.width, path).toBeGreaterThanOrEqual(44);
    }
  });

  test("the sheet fits the screen, its controls are touch-sized and Save clears the keyboard", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/library");
    await page.getByRole("button", { name: "Add manually" }).click();
    const sheet = page.getByRole("dialog", { name: "Add manually" });
    await expect(sheet).toBeVisible();
    await page.getByRole("button", { name: "Game" }).click();
    const overflow = await sheet.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow, "the sheet is wider than its box").toBeLessThanOrEqual(0);
    if (isMobile) {
      const small = await sheet.locator("input, textarea, button").evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent)
          .map((e) => ({
            name: e.getAttribute("aria-label") ?? e.id ?? e.textContent,
            h: e.getBoundingClientRect().height,
          }))
          .filter((x) => x.h < 44),
      );
      expect(small, "controls under 44 px").toEqual([]);
    }
    // A 300 px keyboard: the sheet keeps above it and Save stays on screen.
    await sheet.evaluate((el) => el.style.setProperty("--sheet-covered", "300px"));
    const save = (await page.getByRole("button", { name: "Save" }).boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(save.y + save.height).toBeLessThanOrEqual(viewport.height - 300 + 1);
    expect(save.y).toBeGreaterThanOrEqual(0);
  });
});

test.describe("find a match", () => {
  test("the button, the sheet and its compare step fit and are touch-sized", async ({
    page,
    isMobile,
  }) => {
    const hit = {
      id: 42,
      provider: "itunes",
      media_key: "itunes:book:42",
      title: "A very long catalog title that has to wrap inside a 360 px sheet",
      overview: "",
      poster_path: null,
      backdrop_path: null,
      vote_average: 0,
      vote_count: 0,
      release_date: "2020-09-15",
      media_type: "book",
    };
    await mockLibrary(page, [manualItem("book", "Piranesi")], {
      results: [hit, hit].map((h, i) => ({ ...h, id: 42 + i, media_key: `itunes:book:${42 + i}` })),
    });
    await page.goto("/media/book/0b6f1c1e-5d3a-4c2b-9b7e-2f1d3c4b5a69");
    const open = page.getByRole("button", { name: "Find a match" });
    if (isMobile) expect((await open.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await open.click();
    const sheet = page.getByRole("dialog", { name: "Find a match for Piranesi" });
    const small = () =>
      sheet.locator("input, button").evaluateAll((els) =>
        els
          .filter((e) => (e as HTMLElement).offsetParent && !e.closest(".card"))
          .map((e) => ({
            name: e.getAttribute("aria-label") ?? e.textContent?.trim(),
            h: e.getBoundingClientRect().height,
          }))
          .filter((x) => x.h < 44),
      );
    const overflow = () => sheet.evaluate((el) => el.scrollWidth - el.clientWidth);
    await expect(sheet.getByRole("listitem")).toHaveCount(2);
    expect(await overflow(), "results wider than the sheet").toBeLessThanOrEqual(0);
    if (isMobile) expect(await small(), "result step controls under 44 px").toEqual([]);

    await sheet.getByRole("listitem").first().getByRole("button").click();
    await expect(sheet.getByRole("button", { name: "Use this" })).toBeVisible();
    expect(await overflow(), "compare step wider than the sheet").toBeLessThanOrEqual(0);
    if (isMobile) expect(await small(), "compare step controls under 44 px").toEqual([]);
    const split = await sheet
      .getByRole("region", { name: "Yours, kept" })
      .locator("dd")
      .evaluateAll((dds) =>
        dds
          .filter((dd) => {
            const range = document.createRange();
            const text = dd.firstChild!;
            const word = dd.textContent!.trim().split(" ")[0];
            const at = dd.textContent!.indexOf(word);
            range.setStart(text, at);
            range.setEnd(text, at + word.length);
            return range.getClientRects().length > 1;
          })
          .map((dd) => dd.textContent),
      );
    expect(split, "a kept value broken inside a word").toEqual([]);
  });
});

test.describe("error notes", () => {
  for (const path of ["/", "/media/movie/1"]) {
    test(`the retry on ${path} is touch-sized and fits the screen`, async ({ page, isMobile }) => {
      await page.addInitScript(() => Object.assign(window, { __offline: true }));
      await page.goto(path);
      const note = page.getByRole("alert").filter({ hasText: "network unreachable" }).first();
      const retry = note.getByRole("button", { name: "Try again" });
      await expect(retry).toBeVisible();
      const box = (await retry.boundingBox())!;
      const noteBox = (await note.boundingBox())!;
      expect(noteBox.x + noteBox.width).toBeLessThanOrEqual(page.viewportSize()!.width);
      if (isMobile) {
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });
  }
});

test.describe("theming", () => {
  test("overriding a channel token re-skins components at runtime", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const active = page
      .getByRole("navigation", { name: "Categories" })
      .getByRole("button", { pressed: true });
    const background = () => active.evaluate((el) => getComputedStyle(el).backgroundColor);
    const before = await background();
    await page.evaluate(() =>
      document.documentElement.style.setProperty("--clr-primary-rgb", "0 128 255"),
    );
    expect(before).toContain("229, 9, 20");
    await expect.poll(background).toContain("0, 128, 255");
  });
});

test.describe("screen-reader tables", () => {
  test("stay announced without widening the page", async ({ page }) => {
    await page.goto("/profile");
    // These tables exist only for screen readers. A table ignores width:1px and sizes to
    // its content, so hiding the table itself widened the page; the wrapper is hidden
    // instead, which must not cost the table semantics.
    await expect(page.getByRole("table").first()).toBeAttached();
    expect(await page.getByRole("row").count()).toBeGreaterThan(0);
    expect(await page.getByRole("cell").count()).toBeGreaterThan(0);
    // The page width is the assertion that matters: any sr-only table that escapes its
    // wrapper widens the document, whichever card it lives on.
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(over, "an sr-only table is widening the page").toBeLessThanOrEqual(0);
    const widths = await page.evaluate(() =>
      [...document.querySelectorAll("div.sr, table.sr")].map(
        (el) => el.getBoundingClientRect().width,
      ),
    );
    expect(widths.length).toBeGreaterThan(0);
    for (const w of widths) expect(w).toBeLessThanOrEqual(2);
  });
});
