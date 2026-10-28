import { expect, test } from "./fixtures/tauri-ipc";
import { mockLibrary, ipcCalls } from "./fixtures/library";
for (const theme of ["dark", "light"] as const) {
  test(`visual tutorial ${theme} has inert examples and reachable actions`, async ({ page }) => {
    await mockLibrary(page, [], { prefs: { theme } });
    await page.goto("/welcome");
    await page.addStyleTag({ content: "html {font-size:18.4px !important}" });
    await page.evaluate(() => document.documentElement.style.setProperty("--safe-top", "24px"));
    expect(
      await page.getByRole("heading", { level: 1 }).evaluate((e) => e.getBoundingClientRect().top),
    ).toBeGreaterThanOrEqual(56);
    for (const [beat, label] of [
      ["garden", "Next"],
      ["keys", "Continue without keys"],
      ["planner", "Next"],
      ["pace", "Next"],
      ["manual", "Start"],
    ] as const) {
      await expect(page.getByRole("heading", { name: /What do you want to track/ })).toHaveCount(0);
      if (beat !== "keys") {
        const example = page.getByRole("img", {
          name: `${beat} example — preview only`,
          exact: true,
        });
        await expect(example).toBeVisible();
        await expect(example.locator("[inert]")).toHaveCount(1);
        expect(await example.evaluate((e) => e.scrollWidth - e.clientWidth)).toBe(0);
      }
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        ),
      ).toBe(0);
      const next = page.getByRole("button", { name: label, exact: true });
      await next.scrollIntoViewIfNeeded();
      await expect(next).toBeInViewport();
      await next.click();
    }
    await expect(page).not.toHaveURL(/welcome/);
    expect(
      (await ipcCalls(page)).filter(
        (c) => c.cmd === "library_update" || c.cmd === "library_add_manual",
      ),
    ).toEqual([]);
    expect(
      (await ipcCalls(page))
        .filter((c) => c.cmd === "prefs_update")
        .every((c) => !("taste_families" in (c.args as { patch: object }).patch)),
    ).toBe(true);
  });
}
