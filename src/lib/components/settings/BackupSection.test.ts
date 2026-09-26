import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import BackupSection from "./BackupSection.svelte";
import { BackupStore } from "$lib/stores/backup.svelte";
import type { BackupClient } from "$lib/api/backup";
import type { ExportReport, ImportPreview, ImportReport } from "$lib/types/backup";

const PREVIEW: ImportPreview = {
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
  safety_copy: null,
};

function setup(over: Partial<BackupClient> = {}) {
  const client: BackupClient = {
    exportBackup: vi.fn(async () => ({
      path: "C:\\Users\\me\\Documents\\aevum-backup-2026-09-26.zip",
      entries: 8,
      posters: 1,
      bytes: 9000,
    })),
    pickImport: vi.fn(async () => PREVIEW),
    applyImport: vi.fn(async () => REPORT),
    cancelImport: vi.fn(async () => {}),
    ...over,
  };
  const store = new BackupStore(
    client,
    vi.fn(async () => {}),
  );
  render(BackupSection, { store, libraryCount: 7 });
  return { client, store, user: userEvent.setup() };
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });

describe("BackupSection", () => {
  it("export reports what was saved and where", async () => {
    const { client, user } = setup();
    await user.click(button("Export backup"));
    expect(client.exportBackup).toHaveBeenCalledOnce();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Saved 8 items and 1 poster to C:\\Users\\me\\Documents\\aevum-backup-2026-09-26.zip.",
    );
  });

  it("a closed save dialog shows nothing", async () => {
    const { user } = setup({ exportBackup: vi.fn(async () => null) });
    await user.click(button("Export backup"));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("a picked backup is previewed before anything changes", async () => {
    const { client, user } = setup();
    await user.click(button("Import backup"));
    const preview = await screen.findByRole("group", { name: "Backup to import" });
    expect(preview).toHaveTextContent("Sep 20, 2026");
    expect(preview).toHaveTextContent("0.1.0");
    expect(preview).toHaveTextContent("3 items");
    expect(preview).toHaveTextContent("5 activity records");
    expect(preview).toHaveTextContent("2 posters");
    expect(client.applyImport).not.toHaveBeenCalled();
  });

  it("merge applies and shows the summary", async () => {
    const { client, user } = setup();
    await user.click(button("Import backup"));
    await user.click(await screen.findByRole("button", { name: "Merge" }));
    expect(client.applyImport).toHaveBeenCalledWith("merge");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Merged: 2 new, 1 updated, 4 kept.",
    );
    expect(screen.queryByRole("group", { name: "Backup to import" })).not.toBeInTheDocument();
  });

  it("replace asks once more and says what it removes", async () => {
    const { client, user } = setup();
    await user.click(button("Import backup"));
    await user.click(await screen.findByRole("button", { name: "Replace" }));
    expect(client.applyImport).not.toHaveBeenCalled();
    expect(screen.getByText(/your 7 items become the backup's 3/i)).toBeInTheDocument();
    await user.click(button("Back"));
    expect(button("Replace")).toBeInTheDocument();
    await user.click(button("Replace"));
    await user.click(button("Replace library"));
    expect(client.applyImport).toHaveBeenCalledWith("replace");
  });

  it("after a replace it says where the safety copy is", async () => {
    const { user } = setup({
      applyImport: vi.fn(async () => ({
        ...REPORT,
        prefs_restored: true,
        safety_copy: "C:\\data\\pre-import-backup.zip",
      })),
    });
    await user.click(button("Import backup"));
    await user.click(await screen.findByRole("button", { name: "Replace" }));
    await user.click(button("Replace library"));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Your previous library was saved to C:\\data\\pre-import-backup.zip.",
    );
  });

  it("cancel drops the picked backup", async () => {
    const { client, user } = setup();
    await user.click(button("Import backup"));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(client.cancelImport).toHaveBeenCalledOnce();
    expect(screen.queryByRole("group", { name: "Backup to import" })).not.toBeInTheDocument();
  });

  it("shows errors as alerts", async () => {
    const { user } = setup({
      pickImport: vi.fn(async () => Promise.reject("not an Aevum backup")),
    });
    await user.click(button("Import backup"));
    expect(await screen.findByRole("alert")).toHaveTextContent("not an Aevum backup");
  });

  it("disables the buttons while a task runs", async () => {
    let finish: (v: null) => void = () => {};
    const { user } = setup({
      exportBackup: vi.fn(() => new Promise<ExportReport | null>((r) => (finish = r))),
    });
    await user.click(button("Export backup"));
    expect(button("Export backup")).toBeDisabled();
    expect(button("Import backup")).toBeDisabled();
    finish(null);
    await vi.waitFor(() => expect(button("Export backup")).toBeEnabled());
  });
});
