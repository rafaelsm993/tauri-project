import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ItemActions from "./ItemActions.svelte";
import { LibraryStore, type LibraryClient } from "$lib/stores/library.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry, LibraryStatus, Plan } from "$lib/types/library";

const PLAN: Plan = { days: [0], max_session_minutes: 30, since: "2026-10-01" };

function entry(status: LibraryStatus, progress = 3, plan: Plan | null = PLAN): LibraryEntry {
  return {
    key: "tmdb:tv:1",
    snapshot: {
      media_key: "tmdb:tv:1",
      provider: "tmdb",
      media_type: "tv",
      title: "Arcane",
      poster_path: null,
      poster_file: null,
      year: null,
    },
    user: {
      status,
      progress,
      rating: null,
      review: null,
      length: { ...emptyLength(), episodes: 9, episode_minutes: 40 },
      plan,
    },
    created_at: "t",
    updated_at: "t",
  };
}

async function setup(e: LibraryEntry, xpOf = () => 0) {
  const client: LibraryClient = {
    load: vi.fn(async () => [e]),
    add: vi.fn(),
    update: vi.fn(async (_key, patch) => ({ ...e, user: { ...e.user, ...patch } })),
    plan: vi.fn(),
    remove: vi.fn(async () => true),
    posterDir: vi.fn(async () => null),
    retryPosters: vi.fn(async () => {}),
    addManual: vi.fn(),
    editManual: vi.fn(),
    mergePreview: vi.fn(),
    merge: vi.fn(),
    unmerge: vi.fn(),
    retypeManual: vi.fn(),
  } as unknown as LibraryClient;
  const library = new LibraryStore(client);
  await library.hydrate();
  render(ItemActions, { entry: e, total: 9, library, xpOf, dueMinutes: null });
  return { client, user: userEvent.setup() };
}

describe("ItemActions", () => {
  it("shows four labelled actions in a toolbar", async () => {
    await setup(entry("in_progress"));
    const bar = screen.getByRole("toolbar", { name: "Item actions" });
    for (const name of ["Edit plan", "Log session", "Drop", "Remove"]) {
      expect(bar).toContainElement(screen.getByRole("button", { name }));
    }
  });

  it("names Plan when there is no plan yet, and disables Log session", async () => {
    await setup(entry("planning", 0, null));
    expect(screen.getByRole("button", { name: "Plan" })).toBeEnabled();
    const log = screen.getByRole("button", { name: "Log session" });
    expect(log).toBeDisabled();
    expect(log).toHaveAccessibleDescription("Plan it first");
  });

  it("disables Log session once the item is finished", async () => {
    await setup(entry("completed", 9));
    const log = screen.getByRole("button", { name: "Log session" });
    expect(log).toBeDisabled();
    expect(log).toHaveAccessibleDescription("It's finished");
  });

  it("drops an item", async () => {
    const s = await setup(entry("in_progress"));
    await s.user.click(screen.getByRole("button", { name: "Drop" }));
    expect(s.client.update).toHaveBeenCalledWith("tmdb:tv:1", { status: "dropped" });
  });

  it("resumes a dropped item to what its progress says, with Plan and Log off", async () => {
    const s = await setup(entry("dropped", 9));
    expect(screen.getByRole("button", { name: "Edit plan" })).toBeDisabled();
    const log = screen.getByRole("button", { name: "Log session" });
    expect(log).toBeDisabled();
    expect(log).toHaveAccessibleDescription("Resume it first");
    await s.user.click(screen.getByRole("button", { name: "Resume" }));
    expect(s.client.update).toHaveBeenCalledWith("tmdb:tv:1", { status: "completed" });
  });

  it("opens the plan and the log sheets", async () => {
    const s = await setup(entry("in_progress"));
    await s.user.click(screen.getByRole("button", { name: "Log session" }));
    expect(screen.getByRole("dialog", { name: "Log a session of Arcane" })).toBeInTheDocument();
    await s.user.keyboard("{Escape}");
    await s.user.click(screen.getByRole("button", { name: "Edit plan" }));
    expect(screen.getByRole("dialog", { name: /plan/i })).toBeInTheDocument();
  });

  async function confirming(xpOf = () => 65) {
    const s = await setup(entry("in_progress"), xpOf);
    await s.user.click(screen.getByRole("button", { name: "Remove" }));
    return { ...s, sheet: screen.getByRole("dialog", { name: "Remove Arcane?" }) };
  }

  it("asks before removing, and says how much XP goes back", async () => {
    const { client, sheet } = await confirming();
    expect(client.remove).not.toHaveBeenCalled();
    expect(sheet).toHaveTextContent("You lose the 65 XP it earned.");
    expect(sheet).toHaveTextContent(/progress, rating and plan/i);
  });

  it("removes once confirmed", async () => {
    const { client, sheet, user } = await confirming();
    await user.click(within(sheet).getByRole("button", { name: "Remove" }));
    expect(client.remove).toHaveBeenCalledExactlyOnceWith("tmdb:tv:1");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("keeps the item on Keep or Escape", async () => {
    const { client, sheet, user } = await confirming();
    await user.click(within(sheet).getByRole("button", { name: "Keep" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(client.remove).not.toHaveBeenCalled();
  });

  it("leaves the XP line out when the item earned none", async () => {
    const { sheet } = await confirming(() => 0);
    expect(sheet).not.toHaveTextContent("XP");
  });
});
