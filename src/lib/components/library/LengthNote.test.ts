import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LengthNote from "./LengthNote.svelte";

describe("LengthNote", () => {
  it("reads as a note with the reason", () => {
    render(LengthNote, { text: "TMDB doesn't list it." });
    expect(screen.getByRole("note")).toHaveTextContent("TMDB doesn't list it.");
  });

  it("offers Add length when it can open the length sheet", async () => {
    const onadd = vi.fn();
    render(LengthNote, { text: "x", onadd });
    await userEvent.click(screen.getByRole("button", { name: "Add length" }));
    expect(onadd).toHaveBeenCalledOnce();
  });

  it("has no button where the fields are already on screen", () => {
    render(LengthNote, { text: "x" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
