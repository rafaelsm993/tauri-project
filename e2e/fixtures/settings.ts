import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export type SettingsSection = "Theme" | "Profile" | "Preferences" | "Backup";
export type SettingsPicker =
  "Accent" | "Palette" | "Background" | "Tree effect" | "Profile artwork" | "Title";

export function settingsSection(page: Page, name: SettingsSection) {
  return page.locator(`details[data-section="${name}"]`);
}

export async function openSettingsSection(page: Page, name: SettingsSection) {
  const section = settingsSection(page, name);
  await expect(section).toBeVisible();
  if (!(await section.evaluate((element) => (element as HTMLDetailsElement).open))) {
    if (await page.locator(".picker-panel:popover-open").count())
      await page.keyboard.press("Escape");
    await section.locator(":scope > summary").click();
  }
  await expect(section).toHaveAttribute("open", "");
  return section;
}

export async function openSettingsPicker(page: Page, name: SettingsPicker) {
  const other = page.locator(
    `.reward-picker:not([data-picker="${name}"]) .picker-panel:popover-open`,
  );
  if (await other.count()) await page.keyboard.press("Escape");
  await openSettingsSection(
    page,
    name === "Title" || name === "Profile artwork" ? "Profile" : "Theme",
  );
  const root = page.locator(`.reward-picker[data-picker="${name}"]`);
  const trigger = root.locator(".picker-trigger");
  const panel = root.locator("[popover]");
  if (!(await panel.evaluate((element) => element.matches(":popover-open")))) await trigger.click();
  await expect(panel).toBeVisible();
  await expect.poll(() => panel.evaluate((element) => element.matches(":popover-open"))).toBe(true);
  return panel;
}

export async function openSettingsChoice(page: Page, name: SettingsPicker, option: string) {
  const panel = await openSettingsPicker(page, name);
  return panel.getByRole("button", { name: option, exact: true, includeHidden: true });
}
