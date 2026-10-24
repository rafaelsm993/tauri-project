import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ManualForm from "./ManualForm.svelte";
import { emptyLength } from "$lib/domain/length";
import type { LibraryEntry, MediaSnapshot } from "$lib/types/library";
import type { MediaType } from "$lib/types/media";

function saved(type: MediaType, title: string, extra: Partial<MediaSnapshot> = {}): LibraryEntry {
  const key = `manual:${type}:1`;
  return {
    key,
    snapshot: {
      media_key: key,
      provider: "manual",
      media_type: type,
      title,
      poster_path: null,
      poster_file: null,
      year: null,
      ...extra,
    },
    user: {
      status: "planning",
      progress: 0,
      rating: null,
      review: null,
      length: { ...emptyLength(), pages: 412 },
      plan: null,
    },
    created_at: "t",
    updated_at: "t",
  };
}

function form(props: Partial<Parameters<typeof render<typeof ManualForm>>[1]> = {}) {
  const onsave = vi.fn();
  const onopen = vi.fn();
  const oncancel = vi.fn();
  render(ManualForm, {
    type: "movie",
    title: "",
    entries: [],
    onsave,
    onopen,
    oncancel,
    ...props,
  });
  return { onsave, onopen, oncancel, user: userEvent.setup() };
}

const save = () => screen.getByRole("button", { name: "Save" });

describe("ManualForm", () => {
  it("starts from the prefilled type and title", () => {
    form({ type: "book", title: "Dune" });
    expect(screen.getByRole("button", { name: "Book" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Title")).toHaveValue("Dune");
  });

  it("needs a title: Save marks the field and sends nothing", async () => {
    const { onsave, user } = form();
    await user.click(save());
    const title = screen.getByLabelText("Title");
    expect(title).toHaveAttribute("aria-invalid", "true");
    expect(title).toHaveAccessibleDescription("Add a title.");
    expect(onsave).not.toHaveBeenCalled();
  });

  it("names the creator field for the type and switches the length fields with it", async () => {
    const { user } = form({ type: "movie" });
    expect(screen.getByLabelText("Director")).toBeInTheDocument();
    expect(screen.getByLabelText("Runtime (minutes)")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Book" }));
    expect(screen.getByLabelText("Author")).toBeInTheDocument();
    expect(screen.getByLabelText("Pages")).toBeInTheDocument();
    expect(screen.queryByLabelText("Runtime (minutes)")).toBeNull();
  });

  it("asks for platforms only for games", async () => {
    const { user } = form({ type: "book" });
    expect(screen.queryByLabelText(/Platforms/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Game" }));
    expect(screen.getByLabelText(/Platforms/)).toBeInTheDocument();
  });

  it("previews comma-separated genres as chips", async () => {
    const { user } = form();
    await user.type(screen.getByLabelText(/Genres/), "Sci-fi, drama ,sci-fi");
    const chips = screen.getByRole("list", { name: "Genre preview" });
    expect(chips).toHaveTextContent("Sci-fi");
    expect(chips.querySelectorAll("li")).toHaveLength(2);
  });

  it("sends the draft and the user's length, starting as Planning", async () => {
    const { onsave, user } = form({ type: "game" });
    await user.type(screen.getByLabelText("Title"), "Hades");
    await user.type(screen.getByLabelText("Year"), "2020");
    await user.type(screen.getByLabelText("Developer"), "Supergiant");
    await user.type(screen.getByLabelText(/Genres/), "Roguelike, Action");
    await user.type(screen.getByLabelText(/Platforms/), "PC, Switch");
    await user.type(screen.getByLabelText("Description"), "Escape the underworld.");
    await user.type(screen.getByLabelText("Hours to finish"), "25");
    await user.click(save());
    expect(onsave).toHaveBeenCalledExactlyOnceWith(
      {
        media_type: "game",
        title: "Hades",
        year: "2020",
        creator: "Supergiant",
        overview: "Escape the underworld.",
        genres: ["Roguelike", "Action"],
        platforms: ["PC", "Switch"],
      },
      { status: "planning", length: { ...emptyLength(), hours: 25 } },
    );
  });

  it("refuses a year that isn't four digits", async () => {
    const { onsave, user } = form();
    await user.type(screen.getByLabelText("Title"), "X");
    await user.type(screen.getByLabelText("Year"), "65");
    await user.click(save());
    expect(screen.getByLabelText("Year")).toHaveAttribute("aria-invalid", "true");
    expect(onsave).not.toHaveBeenCalled();
  });

  it("warns about a look-alike already saved; Save anyway goes ahead", async () => {
    const dune = saved("book", "Dune");
    const { onsave, user } = form({ type: "book", title: "dune", entries: [dune] });
    await user.click(save());
    expect(onsave).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Dune is already in your library.");
    await user.click(screen.getByRole("button", { name: "Save anyway" }));
    expect(onsave).toHaveBeenCalledOnce();
  });

  it("the look-alike prompt can open the saved item instead", async () => {
    const dune = saved("book", "Dune");
    const { onsave, onopen, user } = form({ type: "book", title: "Dune", entries: [dune] });
    await user.click(save());
    await user.click(screen.getByRole("button", { name: "Open it" }));
    expect(onopen).toHaveBeenCalledExactlyOnceWith(dune);
    expect(onsave).not.toHaveBeenCalled();
  });

  it("editing fills the fields and the length, locks the type, and sends the length", async () => {
    const dune = saved("book", "Dune", {
      year: "1965",
      creator: "Frank Herbert",
      genres: ["Sci-fi"],
      overview: "Spice.",
    });
    const { onsave, user } = form({ type: "book", edit: dune, entries: [dune] });
    expect(screen.getByRole("heading")).toHaveTextContent("Edit Dune");
    expect(screen.getByLabelText("Author")).toHaveValue("Frank Herbert");
    expect(screen.getByLabelText(/Genres/)).toHaveValue("Sci-fi");
    expect(screen.getByRole("button", { name: "Movie" })).toBeDisabled();
    expect(screen.getByLabelText("Pages")).toHaveValue(412);
    await user.clear(screen.getByLabelText("Title"));
    await user.type(screen.getByLabelText("Title"), "Dune Messiah");
    await user.clear(screen.getByLabelText("Pages"));
    await user.type(screen.getByLabelText("Pages"), "500");
    await user.click(save());
    expect(onsave).toHaveBeenCalledExactlyOnceWith(
      {
        media_type: "book",
        title: "Dune Messiah",
        year: "1965",
        creator: "Frank Herbert",
        overview: "Spice.",
        genres: ["Sci-fi"],
        platforms: [],
      },
      { length: { ...emptyLength(), pages: 500 } },
    );
  });

  it("editing sends only the length, never a status", async () => {
    const dune = saved("book", "Dune");
    const { onsave, user } = form({ type: "book", edit: dune, entries: [dune] });
    await user.click(save());
    expect(onsave.mock.calls[0][1]).toEqual({ length: { ...emptyLength(), pages: 412 } });
  });

  it("disables everything while saving and shows the backend's reason", () => {
    form({ busy: true, error: "disk full" });
    expect(save()).toBeDisabled();
    expect(screen.getByLabelText("Title")).toBeDisabled();
    expect(screen.getByText(/disk full/)).toBeInTheDocument();
  });

  it("Cancel asks to close", async () => {
    const { oncancel, user } = form();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(oncancel).toHaveBeenCalledOnce();
  });

  it("a Close button at the top asks to close too", async () => {
    const { oncancel, user } = form();
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(oncancel).toHaveBeenCalledOnce();
  });
});
