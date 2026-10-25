import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, ipcCalls, item, mockLibrary } from "./fixtures/library";

const completed = () => {
  const entry = item(900000, "movie", "Earned movie", { runtime_minutes: 100 }, null);
  entry.user.status = "completed";
  entry.user.progress = 1;
  return entry;
};

test("failed activity reload cannot authorize equipment from the previous log", async ({
  page,
}) => {
  const sources: string[] = [];
  page.on("request", (request) => sources.push(request.url()));
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    prefs: { accent: "ember", motif: "bubbles" },
  });
  await page.goto("/profile");
  await expect(
    page.getByRole("region", { name: "Level" }).getByRole("img", { name: /^Level 3,/ }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--clr-primary-rgb")),
    )
    .not.toBe("");
  const source = sources.find((name) => name.includes("/src/lib/stores/gamification.svelte.ts"));
  if (!source) throw new Error("Loaded gamification module not found");
  await page.evaluate(async (source) => {
    const { gamificationStore } = await import(/* @vite-ignore */ source);
    const internal = (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string, args?: unknown) => Promise<unknown> };
      }
    ).__TAURI_INTERNALS__;
    const invoke = internal.invoke;
    internal.invoke = (cmd, args) =>
      cmd === "library_events" ? Promise.reject("activity unreadable") : invoke(cmd, args);
    await gamificationStore.load({ quiet: true });
  }, source);
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--clr-primary-rgb")),
    )
    .toBe("");
  await expect(page.locator(".circles")).toHaveAttribute("data-motif", "default");
});

test("historical level cannot keep any equipped reward active", async ({ page }) => {
  await mockLibrary(page, [], {
    seenLevel: 25,
    prefs: {
      accent: "ocean",
      pack: "midnight",
      motif: "aurora",
      garden: "sway",
      title: "Enthusiast",
    },
  });
  await page.goto("/profile");
  const level = page.getByRole("region", { name: "Level" });
  await expect(level.getByRole("img", { name: /^Level 1,/ })).toBeVisible();
  await expect(level.getByText("Newcomer", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ocean", exact: true })).toHaveCount(0);
  await expect(page.locator(".circles")).toHaveAttribute("data-motif", "default");
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--clr-primary-rgb")),
    )
    .toBe("");
  expect((await ipcCalls(page)).filter((call) => call.cmd === "prefs_update")).toEqual([]);
});

test("removing an XP source relocks the equipped accent without clearing the preference", async ({
  page,
}) => {
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    prefs: { accent: "ember", title: "Curious Mind" },
  });
  await page.goto("/media/movie/900000");
  await expect(page.getByRole("link", { name: "Profile · Level 3", exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--clr-primary-rgb")),
    )
    .not.toBe("");
  await page.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("link", { name: "Profile · Level 2", exact: true }).click();
  const level = page.getByRole("region", { name: "Level" });
  await expect(level.getByRole("img", { name: /^Level 2,/ })).toBeVisible();
  await expect(level.getByText("Newcomer", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--clr-primary-rgb")),
    )
    .toBe("");
  const prefs = await page.evaluate(() =>
    (
      window as unknown as {
        __TAURI_INTERNALS__: { invoke: (cmd: string) => Promise<Record<string, unknown>> };
      }
    ).__TAURI_INTERNALS__.invoke("prefs_load"),
  );
  expect(prefs).toMatchObject({ accent: "ember", title: "Curious Mind", seen_level: 25 });
  expect((await ipcCalls(page)).filter((call) => call.cmd === "prefs_update")).toEqual([]);
});

test("uncompleting does not retract one-time completion XP or level-based equipment", async ({
  page,
}) => {
  await mockLibrary(page, [completed()], {
    events: eventsAtLevel(3),
    seenLevel: 25,
    prefs: { accent: "ember" },
  });
  await page.goto("/media/movie/900000");
  const profile = page.getByRole("link", { name: "Profile · Level 3", exact: true });
  await expect(profile).toBeVisible();
  await page.getByRole("button", { name: "Watched", exact: true }).click();
  await expect(page.getByText("Status: Planning", { exact: true })).toBeVisible();
  await expect(profile).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.style.getPropertyValue("--clr-primary-rgb")),
    )
    .not.toBe("");
  expect((await ipcCalls(page)).filter((call) => call.cmd === "prefs_update")).toEqual([]);
});
