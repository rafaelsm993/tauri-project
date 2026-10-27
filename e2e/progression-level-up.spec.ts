import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, item, mockLibrary } from "./fixtures/library";

for (const path of ["/library"]) {
  test(`${path}: earned XP updates the mounted tree and preview across every level gate`, async ({
    page,
  }) => {
    const entries = Array.from({ length: 50 }, (_, i) => {
      const entry = item(i + 1, "tv", `Completed series ${i + 1}`, {}, null);
      entry.user.status = "completed";
      return entry;
    });
    await mockLibrary(page, entries, { events: [], seenLevel: 200, motion: false });
    const storeRequests: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/stores/gamification.svelte.ts"))
        storeRequests.push(request.url());
    });
    await page.goto(path);
    if (path === "/library") await page.getByRole("button", { name: "Tree", exact: true }).click();
    await page.getByRole("button", { name: "TV", exact: true }).click();
    const tree = page.getByRole("region", { name: "TV subtree" });
    const map = tree.getByRole("group", { name: "Journey milestones" });
    await expect(tree.getByText("Current level 1", { exact: true })).toBeVisible();
    await map.evaluate((el) => {
      el.dataset.levelProbe = "same-tree";
    });
    const nodes = map.locator('[data-kind="art"]');
    const finalSeal = nodes.nth(4).locator(".node-seal");
    const lockedFill = await finalSeal.evaluate((el) => getComputedStyle(el).backgroundColor);
    await nodes.nth(4).click();
    const popup = page.getByRole("dialog", { name: "Signal Keeper tier 5" });
    await popup.evaluate((el) => {
      el.dataset.levelProbe = "same-preview";
    });
    const storeUrl = storeRequests.at(-1);
    if (!storeUrl) throw new Error("The production gamification store did not load");
    for (const level of [1, 2, 3, 4, 5, 7, 8, 11, 12, 200, 11, 7, 4, 2, 1]) {
      await page.evaluate(
        async ({ events, url }) => {
          const { gamificationStore } = await import(url);
          gamificationStore.events = events;
        },
        { events: eventsAtLevel(level), url: storeUrl },
      );
      await expect(tree.getByText(`Current level ${level}`, { exact: true })).toHaveCount(1);
      await expect(map).toHaveAttribute("data-level-probe", "same-tree");
      await expect(nodes).toHaveCount(5);
      for (const [i, minimum] of [1, 3, 5, 8, 12].entries()) {
        const unlocked = level >= minimum;
        await expect(nodes.nth(i)).toContainText(`50 / ${[1, 5, 10, 25, 50][i]}`);
        await expect(nodes.nth(i)).toContainText(unlocked ? "Available" : "Locked");
        await expect(nodes.nth(i)).toHaveClass(unlocked ? /\bavailable\b/ : /\blocked\b/);
        await expect(nodes.nth(i).locator("[data-lock]")).toHaveCount(unlocked ? 0 : 1);
        await expect(nodes.nth(i)).toBeEnabled();
      }
      await expect(popup).toHaveAttribute("data-level-probe", "same-preview");
      await expect(popup).toContainText("50 / 50 completed");
      await expect(popup).toContainText(level >= 12 ? "Available" : "Requirements not met");
      const fill = () => finalSeal.evaluate((el) => getComputedStyle(el).backgroundColor);
      if (level >= 12) await expect.poll(fill).not.toBe(lockedFill);
      else await expect.poll(fill).toBe(lockedFill);
      await expect(nodes.nth(4).locator(".profile-artwork")).toHaveCSS(
        "filter",
        level >= 12 ? "none" : "saturate(0.35)",
      );
    }
    await page.goBack();
    await expect(popup).toHaveCount(0);
    await expect(nodes.nth(4)).toBeFocused();
    await page.goBack();
    await expect(page.getByRole("button", { name: "TV", exact: true })).toContainText(
      "50 completed",
    );
    expect(
      await page.evaluate(() =>
        (window as unknown as { __ipcCalls: { cmd: string }[] }).__ipcCalls.filter((c) =>
          /^(prefs_update|library_(add|update|remove|plan))$/.test(c.cmd),
        ),
      ),
    ).toEqual([]);
  });
}

test("global reward relocks in its mounted home without media completions", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/stores/gamification.svelte.ts")) requests.push(request.url());
  });
  await mockLibrary(page, [], { events: [], seenLevel: 200, motion: false });
  await page.goto("/library");
  await page.getByRole("button", { name: "Tree", exact: true }).click();
  await page.getByRole("button", { name: "Movies", exact: true }).click();
  const map = page.getByRole("group", { name: "Journey milestones" });
  await map.evaluate((element) => {
    element.setAttribute("data-live-probe", "same");
  });
  const seal = map.getByRole("button", { name: "Preview Bubbles", exact: true });
  await seal.click();
  const popup = page.getByRole("dialog", { name: "Bubbles", exact: true });
  await expect(popup).toBeVisible();
  await popup.evaluate((element) => {
    element.setAttribute("data-live-probe", "same");
  });
  const url = requests.at(-1);
  expect(url).toBeTruthy();
  for (const level of [1, 2, 3, 1]) {
    await page.evaluate(
      async ({ url, events }) => {
        const { gamificationStore } = await import(url);
        gamificationStore.events = events;
      },
      { url: url!, events: eventsAtLevel(level) },
    );
    await expect(page.locator(".level-caption")).toHaveText(`Current level ${level}`);
    await expect(map).toHaveAttribute("data-live-probe", "same");
    await expect(popup).toHaveAttribute("data-live-probe", "same");
    await expect(seal).toContainText(level >= 2 ? "Available" : "Locked");
    await expect(popup).toContainText(level >= 2 ? "Available" : "Requirements not met");
    const states = await map.locator('[data-kind="art"]').allTextContents();
    expect(states).toHaveLength(5);
    expect(states.every((state) => state.includes("Locked"))).toBe(true);
    const adjacent = map.locator(
      '.journey-edge[data-from="motif:bubbles"], .journey-edge[data-to="motif:bubbles"]',
    );
    expect(await adjacent.count()).toBeGreaterThan(0);
    if (level === 1) {
      for (const edge of await adjacent.all()) await expect(edge).not.toHaveClass(/earned/);
    }
  }
  await page.goBack();
  await expect(popup).toHaveCount(0);
  await expect(seal).toBeFocused();
  expect(
    await page.evaluate(() =>
      (
        window as unknown as {
          __ipcCalls: { cmd: string }[];
        }
      ).__ipcCalls.filter((call) =>
        /^(prefs_update|library_(add|update|remove|plan))$/.test(call.cmd),
      ),
    ),
  ).toEqual([]);
});
