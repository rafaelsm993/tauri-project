import { openSettingsSection } from "./fixtures/settings";
import { expect, test } from "./fixtures/tauri-ipc";
import { item, mockLibrary } from "./fixtures/library";

const LIBRARY = [item(1, "movie", "Dune", {}, null)];

test.describe("welcome", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.assign(window, { __freshInstall: true }));
  });

  test("a fresh install is greeted and lands on the garden beat", async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto("/");

    await expect(page).toHaveURL(/\/welcome/);
    await expect(page.getByRole("heading", { level: 1, name: /grow/i })).toBeVisible();
  });

  test("a user with a library is never sent to the welcome", async ({ page }) => {
    await mockLibrary(page, LIBRARY);
    await page.goto("/");

    await expect(page).not.toHaveURL(/\/welcome/);
    await expect(page.getByRole("heading", { level: 1, name: /grow/i })).toHaveCount(0);
  });

  test("the read-only Books-path preview fits without overflow", async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto("/welcome");
    const preview = page.getByRole("img", { name: "garden example — preview only" });
    await expect(preview.locator(".runic-map")).toHaveCount(1);
    await expect(preview.locator("[inert]")).toHaveCount(1);
    expect(await preview.evaluate((el) => el.scrollWidth - el.clientWidth)).toBe(0);
  });

  test("the welcome clears the system status bar", async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto("/welcome");

    const heading = page.getByRole("heading", { level: 1 });
    const top = await heading.evaluate((el) => el.getBoundingClientRect().top);
    // Page padding keeps the title off the very top edge, where Android draws the clock.
    expect(top).toBeGreaterThanOrEqual(16);
  });

  test("a deep link is not hijacked by the welcome", async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto("/settings");
    await openSettingsSection(page, "Preferences");

    await expect(page).not.toHaveURL(/\/welcome/);
    await expect(page.getByRole("heading", { level: 1, name: /settings/i })).toBeVisible();
  });

  test("skipping leaves the welcome and does not come back", async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto("/welcome");

    await page.getByRole("button", { name: /skip/i }).click();
    await expect(page).not.toHaveURL(/\/welcome/);

    await page.goto("/");
    await expect(page).not.toHaveURL(/\/welcome/);
  });

  test("walks all five beats and finishes", async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto("/welcome");

    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /key/i })).toBeVisible();

    await page.getByRole("button", { name: /continue without keys/i }).click();
    await expect(page.getByRole("heading", { level: 1, name: /plan/i })).toBeVisible();

    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Pages and chapters");
    await page.getByRole("button", { name: "Next", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("match it later");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page).not.toHaveURL(/\/welcome/);
  });

  test("the welcome fits its width with no overflow", async ({ page }) => {
    await mockLibrary(page, []);
    await page.goto("/welcome");

    for (const step of ["Next", "Continue without keys", "Next", "Next", "Start"]) {
      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollW).toBeLessThanOrEqual(clientW);
      await page.getByRole("button", { name: step, exact: true }).click();
    }
  });

  test("every beat can be skipped and the buttons are touch sized", async ({ page, isMobile }) => {
    await mockLibrary(page, []);
    await page.goto("/welcome");

    const skip = page.getByRole("button", { name: /skip/i });
    await expect(skip).toBeVisible();
    if (isMobile) {
      const box = await skip.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("legacy welcome choices no longer select Home categories", async ({ page }) => {
    await mockLibrary(page, [], { prefs: { welcomed: true, taste_families: ["game"] } });
    await page.goto("/");
    const categories = page.getByRole("navigation", { name: "Categories" });
    await expect(categories.getByRole("button", { name: "Movies", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await categories.getByRole("button", { name: "Books", exact: true }).click();
    await page.getByRole("link", { name: "Library", exact: true }).click();
    await page.getByRole("link", { name: "Home", exact: true }).click();
    await expect(categories.getByRole("button", { name: "Books", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("legacy taste is ignored when prefs load after the page mounts", async ({ page }) => {
    await mockLibrary(page, []);
    // Prefs resolve only once Home has mounted, as on a cold start on a real device.
    await page.addInitScript(() => {
      const w = window as unknown as {
        __TAURI_INTERNALS__: { invoke: (c: string, a?: unknown) => Promise<unknown> };
        __mounted?: () => void;
      };
      const mounted = new Promise<void>((resolve) => {
        w.__mounted = resolve;
      });
      const real = w.__TAURI_INTERNALS__.invoke;
      w.__TAURI_INTERNALS__.invoke = async (cmd: string, args?: unknown) => {
        const out = await real(cmd, args);
        if (cmd === "prefs_load") {
          await mounted;
          return { ...(out as object), welcomed: true, taste_families: ["game"] };
        }
        return out;
      };
    });
    await page.goto("/");

    // The category bar is on screen, so prefs arrived strictly after the page was interactive.
    await expect(page.getByRole("navigation", { name: "Categories" })).toBeVisible();
    await page.evaluate(() => (window as unknown as { __mounted: () => void }).__mounted());

    const games = page.getByRole("button", { name: "Movies", exact: true });
    await expect(games).toHaveAttribute("aria-pressed", "true");
  });

  test("a prefs field the backend does not know is rejected, not silently dropped", async ({
    page,
  }) => {
    await mockLibrary(page, []);
    await page.goto("/welcome");

    const result = await page.evaluate(async () => {
      const invoke = (
        window as unknown as { __TAURI_INTERNALS__: { invoke: (c: string, a: unknown) => unknown } }
      ).__TAURI_INTERNALS__.invoke;
      try {
        await invoke("prefs_update", { patch: { welcomd: true } });
        return "accepted";
      } catch {
        return "rejected";
      }
    });

    expect(result).toBe("rejected");
  });

  test("settings can replay the welcome", async ({ page }) => {
    await mockLibrary(page, LIBRARY);
    await page.goto("/settings");
    await openSettingsSection(page, "Preferences");

    await page.getByRole("button", { name: /run the welcome again/i }).click();
    await expect(page).toHaveURL(/\/welcome/);
  });
});

for (const [tmdb, rawg, label] of [
  [false, false, "Continue without keys"],
  [true, false, "Continue without RAWG key"],
  [false, true, "Continue without TMDB key"],
  [true, true, "Continue"],
] as const) {
  test(`key drafts update CTA ${tmdb}/${rawg} and validate before proceeding`, async ({ page }) => {
    await mockLibrary(page, [], { prefs: { welcome_beat: 1 } });
    await page.addInitScript(() => {
      const w = window as unknown as {
        __TAURI_INTERNALS__: { invoke: (c: string, a?: { which?: string }) => Promise<unknown> };
        __keyCalls: string[];
      };
      const real = w.__TAURI_INTERNALS__.invoke;
      const presence: Record<string, boolean> = { tmdb: false, rawg: false };
      w.__keyCalls = [];
      w.__TAURI_INTERNALS__.invoke = async (c, a) => {
        if (c === "keys_status") return { ...presence };
        if (c === "keys_check") {
          w.__keyCalls.push("check:" + a!.which);
          return null;
        }
        if (c === "keys_set") {
          w.__keyCalls.push("set:" + a!.which);
          presence[a!.which!] = true;
          return { ...presence };
        }
        return real(c, a);
      };
    });
    await page.goto("/welcome");
    if (tmdb) await page.getByLabel("TMDB key").fill("TEST_ONLY_TMDB");
    if (rawg) await page.getByLabel("RAWG key").fill("TEST_ONLY_RAWG");
    await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
    await expect(page.getByText("Saved and working.", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Plan it when you are ready",
    );
    expect(
      await page.evaluate(() => (window as unknown as { __keyCalls: string[] }).__keyCalls),
    ).toEqual([
      ...(tmdb ? ["check:tmdb", "set:tmdb"] : []),
      ...(rawg ? ["check:rawg", "set:rawg"] : []),
    ]);
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await expect(page.getByRole("button", { name: label, exact: true })).toBeEnabled();
  });
}
for (const [index, title] of [
  [2, "Plan it when you are ready"],
  [3, "Plan it when you are ready"],
  [4, "Pages and chapters need different paces"],
  [5, "Add anything, match it later"],
] as const) {
  test(`saved index ${index} resumes and reloads its original beat`, async ({ page }) => {
    await mockLibrary(page, [], {
      prefs: { welcomed: false, welcome_beat: index },
      persistPrefs: true,
    });
    await page.goto("/welcome");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(title);
  });
}
