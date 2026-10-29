import { expect, test } from "@playwright/test";
import { eventsAtLevel, mockLibrary } from "./fixtures/library";
import { openSettingsPicker, openSettingsSection } from "./fixtures/settings";

for (const theme of ["dark", "light"]) {
  test(`${theme}: Theme labels and option names sit above previews`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await mockLibrary(page, [], { events: eventsAtLevel(25), seenLevel: 25, prefs: { theme } });
    await page.goto("/settings");
    await page.addStyleTag({ content: "html { font-size: 18.4px !important; }" });
    await openSettingsSection(page, "Theme");
    for (const name of ["Accent", "Palette", "Background", "Tree effect"] as const) {
      const root = page.locator(`.reward-picker[data-picker="${name}"]`);
      await root.scrollIntoViewIfNeeded();
      const field = (await root.locator(".field-label").boundingBox())!;
      const trigger = root.locator(".picker-trigger");
      const box = (await trigger.boundingBox())!;
      expect(field.y + field.height).toBeLessThanOrEqual(box.y + 1);
      const text = (await trigger.locator(".current").boundingBox())!;
      const picture = (await trigger.locator(".preview").boundingBox())!;
      expect(text.y + text.height).toBeLessThanOrEqual(picture.y + 1);
      expect(picture.width).toBeGreaterThan(0);
      const panel = await openSettingsPicker(page, name);
      const option = panel.locator(".picker-option").first();
      const copy = (await option.locator(".option-copy").boundingBox())!;
      const image = (await option.locator(".preview").boundingBox())!;
      expect(copy.y + copy.height).toBeLessThanOrEqual(image.y + 1);
      await page.keyboard.press("Escape");
      await expect(panel).toBeHidden();
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBe(0);
    await openSettingsSection(page, "Profile");
    await expect(page.locator('[data-picker="Avatar"]')).not.toHaveClass(/stacked/);
  });
}

test("desktop Settings is one column centred beside the rail", async ({ page }) => {
  test.skip(page.viewportSize()!.width <= 768, "desktop layout only");
  await mockLibrary(page, []);
  await page.goto("/settings");
  const heading = (await page.getByRole("heading", { name: "Settings", level: 1 }).boundingBox())!;
  const section = (await page.locator("details.settings-section").first().boundingBox())!;
  const rail = (await page.getByRole("navigation", { name: "Main" }).boundingBox())!;
  const right = await page.evaluate(() => document.documentElement.clientWidth);
  const roomCentre = (rail.x + rail.width + right) / 2;
  expect(
    Math.abs(section.x + section.width / 2 - roomCentre),
    "sections are off-centre",
  ).toBeLessThanOrEqual(2);
  expect(
    Math.abs(heading.x - section.x),
    "heading and sections do not line up",
  ).toBeLessThanOrEqual(1);
});
