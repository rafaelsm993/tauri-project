import type { Locator } from "@playwright/test";
import { eventsAtLevel, item, mockLibrary } from "./fixtures/library";
import { expect, test } from "./fixtures/tauri-ipc";

async function expectTrailingTarget(trigger: Locator) {
  const bounds = await trigger.evaluate((button) => {
    const field = button.closest(".search-bar,.search-field")!;
    const b = button.getBoundingClientRect(),
      f = field.getBoundingClientRect();
    return {
      left: b.left,
      right: b.right,
      top: b.top,
      bottom: b.bottom,
      width: b.width,
      height: b.height,
      fieldLeft: f.left,
      fieldRight: f.right,
      fieldTop: f.top,
      fieldBottom: f.bottom,
    };
  });
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.left).toBeGreaterThan(bounds.fieldLeft);
  expect(bounds.right).toBeLessThanOrEqual(bounds.fieldRight);
  expect(bounds.top).toBeGreaterThanOrEqual(bounds.fieldTop);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.fieldBottom);
  expect(bounds.fieldRight - bounds.right).toBeLessThanOrEqual(8);
}

test("header rows show the background and tags exit as one animated group", async ({ page }) => {
  await page.goto("/");
  const tags = page.getByRole("button", { name: "Movies", exact: true });
  await expect(tags).toBeVisible();
  const colors = await page
    .locator(".app-header .row,.app-header .collapsible")
    .evaluateAll((nodes) => nodes.map((e) => getComputedStyle(e).backgroundColor));
  for (const color of colors) expect(color).toBe("rgba(0, 0, 0, 0)");
  const top = await page.locator(".page-body").evaluate((e) => (e as HTMLElement).offsetTop);
  await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
  const group = page.locator(".collapsible-content");
  await expect(page.locator(".collapsible")).toHaveAttribute("inert", "");
  await expect.poll(() => group.evaluate((e) => getComputedStyle(e).opacity)).toBe("0");
  await expect(tags).toBeHidden();
  expect(await page.locator(".page-body").evaluate((e) => (e as HTMLElement).offsetTop)).toBe(top);
  expect(await page.locator(".collapsible").evaluate((e) => getComputedStyle(e).height)).not.toBe(
    "0px",
  );
  await page.evaluate(() => scrollTo({ top: 1100, behavior: "instant" }));
  await expect(tags).toBeVisible();
  await expect.poll(() => group.evaluate((e) => getComputedStyle(e).opacity)).toBe("1");
  expect(await page.locator(".page-body").evaluate((e) => (e as HTMLElement).offsetTop)).toBe(top);
});

test("Home filter lives inside search and fills only for active genres", async ({ page }) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: /^Genres/ });
  await expect(trigger).toBeVisible();
  expect(await trigger.evaluate((e) => !!e.closest(".search-bar"))).toBe(true);
  await expectTrailingTarget(trigger);
  const icon = trigger.locator("svg").first();
  expect(await icon.evaluate((e) => getComputedStyle(e).fill)).toBe("none");
  await trigger.click();
  await page.getByRole("checkbox", { name: "Western", exact: true }).check();
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--clr-accent", "rgb(199, 102, 18)"),
  );
  await expect.poll(() => icon.evaluate((e) => getComputedStyle(e).fill)).toBe("rgb(199, 102, 18)");
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect.poll(() => icon.evaluate((e) => getComputedStyle(e).fill)).toBe("none");
});

test("Library inline filter retains its state when scrolling away and back", async ({ page }) => {
  await mockLibrary(
    page,
    Array.from({ length: 80 }, (_, i) =>
      item(920000 + i, i % 2 ? "movie" : "book", `Header fixture ${i}`, {}, null),
    ),
  );
  await page.goto("/library");
  const trigger = page.getByRole("button", { name: /^Filters/ });
  await expect(trigger).toBeVisible();
  expect(await trigger.evaluate((e) => !!e.closest(".search-field"))).toBe(true);
  await expectTrailingTarget(trigger);
  await trigger.click();
  const panel = page.getByRole("dialog", { name: "Filters", exact: true });
  await expect(panel).toBeVisible();
  await panel
    .getByRole("group", { name: "Status", exact: true })
    .getByRole("button", { name: /^In progress / })
    .click();
  await page.keyboard.press("Escape");
  await page.evaluate(() =>
    document.documentElement.style.setProperty("--clr-accent", "rgb(199, 102, 18)"),
  );
  await expect
    .poll(() => trigger.locator("svg").evaluate((e) => getComputedStyle(e).fill))
    .toBe("rgb(199, 102, 18)");
  await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
  await expect(page.locator(".app-header")).toHaveAttribute("data-collapsed", "false");
  await expect(trigger).not.toBeInViewport();
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  await expect(trigger).toBeInViewport();
  await trigger.click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Reset", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect
    .poll(() => trigger.locator("svg").evaluate((e) => getComputedStyle(e).fill))
    .toBe("none");
});

test("tag group has a reversible mid-flight fade without per-tag transitions", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-header")).toHaveAttribute("data-motion", "true");
  const sample = await page.locator(".collapsible-content").evaluate(
    (group) =>
      new Promise<{
        opacity: number;
        transform: string;
        properties: string[];
        childTransitions: number;
      }>((resolve) => {
        void getComputedStyle(group).opacity;
        const header = group.closest(".app-header")!;
        const observer = new MutationObserver(() => {
          if (header.getAttribute("data-collapsed") !== "true") return;
          observer.disconnect();
          const animations = group.getAnimations();
          for (const animation of animations) {
            animation.pause();
            animation.currentTime = 60;
          }
          const style = getComputedStyle(group);
          const sample = {
            opacity: Number(style.opacity),
            transform: style.transform,
            properties: animations
              .filter((a) => a instanceof CSSTransition)
              .map((a) => (a as CSSTransition).transitionProperty),
            childTransitions: group
              .getAnimations({ subtree: true })
              .filter(
                (a) =>
                  a.effect instanceof KeyframeEffect &&
                  a.effect.target !== group &&
                  a instanceof CSSTransition,
              ).length,
          };
          for (const animation of animations) animation.finish();
          resolve(sample);
        });
        observer.observe(header, { attributes: true });
        scrollTo({ top: 1400, behavior: "instant" });
      }),
  );
  expect(sample.properties).toEqual(expect.arrayContaining(["opacity", "transform"]));
  expect(sample.opacity).toBeGreaterThan(0);
  expect(sample.opacity).toBeLessThan(1);
  expect(sample.transform).not.toBe("none");
  expect(sample.childTransitions).toBe(0);
  await page.evaluate(() => scrollBy({ top: -100, behavior: "instant" }));
  await expect(page.locator(".collapsible-content")).toHaveCSS("opacity", "1");
});

test("reduced motion hides tags immediately without moving layout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".app-header")).toHaveAttribute("data-motion", "false");
  await page.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
  await expect(page.locator(".collapsible")).toHaveAttribute("inert", "");
  await expect(page.locator(".collapsible-content")).toHaveCSS("opacity", "0");
  expect(await page.locator(".collapsible-content").evaluate((e) => e.getAnimations().length)).toBe(
    0,
  );
  await page.evaluate(() => scrollBy({ top: -100, behavior: "instant" }));
  await expect(page.getByRole("button", { name: "Movies", exact: true })).toBeVisible();
});

for (const scheme of ["dark", "light"] as const) {
  test(`Library search has an opaque surface and scrolls out of the way in ${scheme}`, async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await mockLibrary(
      page,
      Array.from({ length: 40 }, (_, i) =>
        item(990000 + i, "movie", `Opaque fixture ${i}`, {}, null),
      ),
    );
    await page.goto("/library");
    const input = page.getByRole("searchbox", { name: "Search your library" });
    await expect(input).toBeVisible();
    const surface = await input.evaluate((e) => {
      const color = getComputedStyle(e).backgroundColor;
      const probe = document.createElement("span");
      probe.style.background = "var(--clr-surface)";
      document.body.append(probe);
      const expected = getComputedStyle(probe).backgroundColor;
      probe.remove();
      const rect = e.getBoundingClientRect();
      return {
        color,
        expected,
        inside:
          e === document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2),
      };
    });
    expect(surface.inside).toBe(true);
    expect(surface.color).toBe(surface.expected);
    expect(surface.color).toMatch(/^rgb\(/);
    await expect(page.locator(".app-header .row").last()).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
    await page.evaluate(() => scrollTo({ top: 500, behavior: "instant" }));
    await expect(input).not.toBeInViewport();
    await expect(page.locator(".app-header")).toHaveAttribute("data-collapsed", "false");
  });
}

for (const route of ["library", "planner", "profile", "settings"] as const) {
  test(`${route} header scrolls away instead of floating over page content`, async ({ page }) => {
    await page.setViewportSize({ ...page.viewportSize()!, height: 560 });
    await mockLibrary(
      page,
      Array.from({ length: 80 }, (_, i) =>
        item(
          950000 + i,
          "book",
          `Flow fixture ${i}`,
          { pages: 300 },
          { days: [0, 2, 4], max_session_minutes: 60, since: "2026-09-28" },
        ),
      ),
      { events: eventsAtLevel(25), seenLevel: 25 },
    );
    await page.goto(`/${route}`);
    if (route === "settings")
      await page.locator("summary").filter({ hasText: "Preferences" }).click();
    const header = page.locator(".app-header");
    await expect(header).toBeVisible();
    const before = await header.boundingBox();
    expect(before).not.toBeNull();
    const y = await page.evaluate(() => {
      scrollTo({ top: 400, behavior: "instant" });
      return new Promise<number>((resolve) => requestAnimationFrame(() => resolve(scrollY)));
    });
    expect(y).toBeGreaterThan(0);
    const after = (await header.boundingBox())!;
    expect(Math.abs(after.y - before!.y + y)).toBeLessThanOrEqual(1);
    expect(after.y + after.height).toBeLessThan(0);
    await expect(header).toHaveAttribute("data-collapsed", "false");
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await expect(header).toBeInViewport();
  });
}
