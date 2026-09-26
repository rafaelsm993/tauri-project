import { describe, expect, it, vi } from "vitest";
import { BackupStore, importSummary } from "./backup.svelte";
import type { BackupClient } from "$lib/api/backup";
import type { ImportReport } from "$lib/types/backup";

const PREVIEW = {
  created_at: "2026-09-20T10:00:00.000Z",
  app_version: "0.1.0",
  entries: 3,
  events: 5,
  posters: 2,
};
const REPORT: ImportReport = {
  added: 2,
  updated: 1,
  kept: 4,
  removed: 0,
  posters: 2,
  prefs_restored: false,
};

function make(over: Partial<BackupClient> = {}) {
  const client: BackupClient = {
    exportBackup: vi.fn(async () => ({
      path: "/h/aevum-backup.zip",
      entries: 8,
      posters: 1,
      bytes: 9000,
    })),
    pickImport: vi.fn(async () => PREVIEW),
    applyImport: vi.fn(async () => REPORT),
    cancelImport: vi.fn(async () => {}),
    ...over,
  };
  const reload = vi.fn(async () => {});
  return { store: new BackupStore(client, reload), client, reload };
}

describe("importSummary", () => {
  it("counts a merge", () => {
    expect(importSummary(REPORT, "merge")).toBe("Merged: 2 new, 1 updated, 4 kept.");
  });

  it("counts a replace and mentions restored settings", () => {
    expect(importSummary({ ...REPORT, prefs_restored: true }, "replace")).toBe(
      "Library replaced with 3 items. Settings restored.",
    );
  });
});

describe("BackupStore", () => {
  it("export reports where the file went", async () => {
    const { store } = make();
    await store.exportNow();
    expect(store.message).toBe("Saved 8 items and 1 poster to /h/aevum-backup.zip.");
  });

  it("a cancelled export says nothing", async () => {
    const { store } = make({ exportBackup: vi.fn(async () => null) });
    await store.exportNow();
    expect(store.message).toBe("");
    expect(store.error).toBe("");
  });

  it("import shows the preview, then applies the chosen mode and reloads", async () => {
    const { store, client, reload } = make();
    await store.pickImport();
    expect(store.preview).toEqual(PREVIEW);
    await store.apply("merge");
    expect(client.applyImport).toHaveBeenCalledWith("merge");
    expect(reload).toHaveBeenCalledWith("merge");
    expect(store.preview).toBeNull();
    expect(store.message).toBe("Merged: 2 new, 1 updated, 4 kept.");
  });

  it("a rejected backup shows why and offers no choice", async () => {
    const { store } = make({
      pickImport: vi.fn(async () =>
        Promise.reject("This backup was made by a newer version of Aevum."),
      ),
    });
    await store.pickImport();
    expect(store.error).toContain("newer version");
    expect(store.preview).toBeNull();
  });

  it("cancel drops the preview and tells the backend", async () => {
    const { store, client } = make();
    await store.pickImport();
    await store.cancel();
    expect(store.preview).toBeNull();
    expect(client.cancelImport).toHaveBeenCalled();
  });

  it("is busy while working", async () => {
    let finish!: () => void;
    const { store } = make({
      exportBackup: vi.fn(() => new Promise<null>((r) => (finish = () => r(null)))),
    });
    const run = store.exportNow();
    expect(store.busy).toBe(true);
    finish();
    await run;
    expect(store.busy).toBe(false);
  });
});
