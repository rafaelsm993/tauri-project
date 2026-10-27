import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, item, mockLibrary } from "./fixtures/library";

const types = ["movie", "tv", "anime", "manga", "book", "game"];
const names = ["Movies", "TV", "Anime", "Manga", "Books", "Games"];

for (const path of ["/library"]) {
  test(`${path}: 5100 items at level 200 stay bounded and reach the last branch member`, async ({
    page,
  }, info) => {
    test.setTimeout(60_000);
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    const entries = types.flatMap((type, t) =>
      Array.from({ length: 850 }, (_, i) => {
        const entry = item(
          100000 + t * 1000 + i,
          type,
          `Scale ${type} ${String(i).padStart(4, "0")}`,
          {},
          null,
        );
        entry.user.status = "completed";
        return entry;
      }),
    );
    await mockLibrary(page, entries, { events: eventsAtLevel(200), seenLevel: 250, motion: false });
    const start = performance.now();
    await page.goto(path);
    if (path === "/library") await page.getByRole("button", { name: "Tree", exact: true }).click();
    const main = page.locator(".main-tree");
    await expect(main).toContainText("Current level 200");
    await expect(main.locator(".level-spine")).toHaveCount(0);
    await expect(main.locator(".map-node")).toHaveCount(6);
    await expect(main.getByText("850 completed", { exact: true })).toHaveCount(6);
    const metrics = {
      routeReadyMs: performance.now() - start,
      mountedNodes: await page.locator(".progression-tree *").count(),
      collapsedLinks: await page.locator(".media-detail a").count(),
    };
    expect(metrics.collapsedLinks).toBeLessThanOrEqual(36);
    for (const name of names) {
      await page
        .getByRole("group", { name: "Explore media trees" })
        .getByRole("button", { name, exact: true })
        .click();
      await expect(page.locator(".media-detail")).toHaveCount(1);
      await expect(page.getByRole("region", { name: `${name} subtree` })).toBeAttached();
      await expect(
        page.getByRole("group", { name: "Journey milestones" }).locator('[data-kind="art"]'),
      ).toHaveCount(5);
      await expect(page.getByText("Available", { exact: true })).toHaveCount(
        name === "Movies" || name === "TV" ? 9 : 8,
      );
      await page.getByRole("button", { name: "All media" }).click();
      await expect(main).toBeVisible();
    }
    await page
      .getByRole("group", { name: "Explore media trees" })
      .getByRole("button", { name: "Movies", exact: true })
      .click();
    await page.getByText("Genres & saved items", { exact: true }).click();
    await expect(page.locator(".genre-branches .leaf")).toHaveCount(6);
    await page.getByRole("button", { name: "Open Unclassified branch" }).click();
    const dialog = page.getByRole("dialog", { name: "Unclassified branch" });
    for (let n = 0; n < 28; n++) {
      await expect(dialog.getByRole("link")).toHaveCount(30);
      await dialog.getByRole("button", { name: "Next items" }).click();
    }
    await expect(dialog.getByRole("link")).toHaveCount(10);
    await expect(dialog.getByRole("link").last()).toHaveAttribute("href", "/media/movie/100849");
    await expect(dialog.getByRole("button", { name: "Next items" })).toBeDisabled();
    await info.attach("scale-metrics", {
      body: JSON.stringify(metrics),
      contentType: "application/json",
    });
    expect(pageErrors).toEqual([]);
    console.log("Runewood scale", info.project.name, path, metrics);
  });
}

test("Profile: 5100 items retain charts without a journey map", async ({ page }, info) => {
  test.setTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const entries = types.flatMap((type, t) =>
    Array.from({ length: 850 }, (_, i) => {
      const entry = item(
        100000 + t * 1000 + i,
        type,
        `Scale ${type} ${String(i).padStart(4, "0")}`,
        {},
        null,
      );
      entry.user.status = "completed";
      return entry;
    }),
  );
  await mockLibrary(page, entries, { events: eventsAtLevel(200), seenLevel: 250, motion: false });
  const started = performance.now();
  await page.goto("/profile");
  const level = page.getByRole("region", { name: "Level", exact: true });
  await expect(level.getByRole("img", { name: /^Level 200,/ })).toBeVisible();
  for (const name of ["Stats", "Progression", "Activity", "Library", "Taste", "Forecast"])
    await expect(page.getByRole("region", { name, exact: true })).toBeVisible();
  await expect(page.locator(".progression-tree")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    ),
  ).toBe(0);
  expect(errors).toEqual([]);
  await info.attach("profile-scale-metrics", {
    body: JSON.stringify({ routeReadyMs: performance.now() - started }),
    contentType: "application/json",
  });
});
