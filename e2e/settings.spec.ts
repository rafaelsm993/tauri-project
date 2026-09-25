import { expect, test } from "./fixtures/tauri-ipc";

test("turning the animated background off saves it", async ({ page }) => {
  await page.goto("/settings");
  const group = page.getByRole("group", { name: "Animated background" });
  await expect(group.getByRole("button", { name: "On" })).toHaveAttribute("aria-pressed", "true");
  await group.getByRole("button", { name: "Off" }).click();
  await expect(group.getByRole("button", { name: "Off" })).toHaveAttribute("aria-pressed", "true");
  const calls = await page.evaluate(
    () => (window as unknown as { __ipcCalls: string[] }).__ipcCalls,
  );
  expect(calls).toContain("prefs_update");
});

test("settings controls are touch-sized on coarse pointers", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mouse viewports may use compact targets");
  await page.goto("/settings");
  const heights = await page
    .getByRole("group", { name: "Animated background" })
    .getByRole("button")
    .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44);
});

test("the background pauses when the animation is turned off", async ({ page }) => {
  await page.goto("/settings");
  const bg = page.locator(".bg-area");
  await expect(bg).not.toHaveClass(/paused/);
  await page
    .getByRole("group", { name: "Animated background" })
    .getByRole("button", { name: "Off" })
    .click();
  await expect(bg).toHaveClass(/paused/);
});
