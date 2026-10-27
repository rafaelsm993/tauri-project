import { expect, test } from "./fixtures/tauri-ipc";
import { eventsAtLevel, mockLibrary } from "./fixtures/library";

const homes = [
  ["Movies", ["Bubbles", "Ember"], ["Newcomer", "Curious Mind"]],
  ["TV", ["Embers", "Runic shimmer"], ["Regular", "Enthusiast"]],
  ["Anime", ["Aurora"], ["Connoisseur", "Devotee"]],
  ["Manga", ["Dusk"], ["Archivist", "Curator"]],
  ["Books", ["Sunrise"], ["Loremaster", "Chronicler"]],
  ["Games", ["Ocean", "Midnight"], ["Aevum Eternal"]],
] as const;

for (const level of [1, 200]) {
  test(`each global reward at level ${level} has one subtree home and previews without saving`, async ({
    page,
  }) => {
    await mockLibrary(page, [], { events: eventsAtLevel(level), seenLevel: 200, motion: false });
    await page.goto("/library");
    await page.getByRole("button", { name: "Tree", exact: true }).click();
    await expect(page.getByRole("heading", { name: "JOURNEY TREE", exact: true })).toBeVisible();
    await expect(page.getByText("THE SHARED ROOT", { exact: true })).toBeVisible();
    await expect(page.getByText("Level rewards", { exact: true })).toHaveCount(0);
    const visited: string[] = [];
    for (const [name, themes, titles] of homes) {
      await page
        .getByRole("group", { name: "Explore media trees" })
        .getByRole("button", { name, exact: true })
        .click();
      const map = page.getByRole("group", { name: "Journey milestones" });
      await expect(map.locator('[data-kind="art"]')).toHaveCount(5);
      await expect(map.getByRole("button")).toHaveCount(5 + themes.length + titles.length);
      for (const label of [
        ...themes.map((value) => `Preview ${value}`),
        ...titles.map((value) => `Preview title ${value}`),
      ]) {
        const seal = map.getByRole("button", { name: label, exact: true });
        visited.push(label);
        await seal.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeFocused();
        await expect(dialog).toContainText(/Requires level \d+/);
        await expect(dialog).toContainText(
          level === 200 || label === "Preview title Newcomer"
            ? "Available"
            : "Requirements not met",
        );
        await expect(dialog.getByRole("button", { name: /equip/i })).toHaveCount(0);
        await page.goBack();
        await expect(dialog).toHaveCount(0);
        await expect(seal).toBeFocused();
      }
      await page.goBack();
      await expect(page.getByRole("button", { name, exact: true })).toBeFocused();
    }
    expect(visited).toHaveLength(20);
    expect(new Set(visited).size).toBe(20);
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
}
