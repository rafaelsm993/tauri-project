import { expect, test } from "./fixtures/tauri-ipc";
import { item, mockLibrary } from "./fixtures/library";
import { levelOf, XP, xpForLevel } from "../src/lib/domain/gamification";
import type { LibraryEvent } from "../src/lib/types/library";

for (const title of ["Newcomer", "automatic", "unknown future title"]) {
  test(`Profile resolves hydrated stored title ${title} through the real stores`, async ({
    page,
  }) => {
    const count = Math.ceil(xpForLevel(3) / (XP.add + XP.completion));
    const entries = Array.from({ length: count }, (_, i) => {
      const entry = item(
        i + 1,
        "movie",
        `Completed movie ${i + 1}`,
        { runtime_minutes: 100 },
        null,
      );
      entry.user.status = "completed";
      entry.user.progress = 100;
      return entry;
    });
    const events: LibraryEvent[] = entries.map((entry, i) => ({
      id: `title-${i}`,
      kind: "library_add",
      media_key: entry.key,
      at_utc: "2026-09-25T12:00:00Z",
      local_date: "2026-09-25",
      payload: { status: "completed" },
    }));
    expect(levelOf(count * (XP.add + XP.completion)).level).toBe(3);
    await mockLibrary(page, entries, { events, seenLevel: 3, prefs: { title } });
    await page.goto("/profile");
    const level = page.getByRole("region", { name: "Level" });
    await expect(level.getByRole("img", { name: /^Level 3,/ })).toBeVisible();
    await expect(
      level.getByText(title === "Newcomer" ? title : "Curious Mind", { exact: true }),
    ).toBeVisible();
    await page.reload();
    await expect(
      level.getByText(title === "Newcomer" ? title : "Curious Mind", { exact: true }),
    ).toBeVisible();
  });
}

for (const fixture of ["catalog", "library"] as const) {
  test(`${fixture} IPC fixture accepts and retains title/art selections`, async ({ page }) => {
    if (fixture === "library") await mockLibrary(page, []);
    await page.goto("/settings");
    const result = await page.evaluate(async () => {
      const { invoke } = (
        window as unknown as {
          __TAURI_INTERNALS__: {
            invoke: (cmd: string, args?: unknown) => Promise<Record<string, unknown>>;
          };
        }
      ).__TAURI_INTERNALS__;
      const before = await invoke("prefs_load");
      const selected = await invoke("prefs_update", {
        patch: { title: "Curious Mind", profile_art: "manga:5" },
      });
      await invoke("prefs_update", { patch: { motion: false } });
      const after = await invoke("prefs_load");
      let rejected = false;
      try {
        await invoke("prefs_update", { patch: { invented_field: true } });
      } catch {
        rejected = true;
      }
      return { before, selected, after, rejected };
    });
    expect(result.before).toMatchObject({ title: "automatic", profile_art: "default" });
    expect(result.selected).toMatchObject({ title: "Curious Mind", profile_art: "manga:5" });
    expect(result.after).toMatchObject({
      title: "Curious Mind",
      profile_art: "manga:5",
      motion: false,
    });
    expect(result.rejected).toBe(true);
  });
}
