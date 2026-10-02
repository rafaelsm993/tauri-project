import { describe, expect, it, vi } from "vitest";
import { createRawSnippet } from "svelte";
import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import ErrorNote from "./ErrorNote.svelte";

describe("ErrorNote", () => {
  it("announces the message as an alert", () => {
    render(ErrorNote, { message: "network unreachable" });
    expect(screen.getByRole("alert")).toHaveTextContent("network unreachable");
  });

  it("offers no retry when nothing can be retried", () => {
    render(ErrorNote, { message: "disk full" });
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("retries when asked", async () => {
    const onretry = vi.fn();
    render(ErrorNote, { message: "network unreachable", onretry });
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onretry).toHaveBeenCalledOnce();
  });

  it("keeps extra actions next to the retry", () => {
    const children = createRawSnippet(() => ({
      render: () => `<button type="button">Back</button>`,
    }));
    render(ErrorNote, { message: "not found", onretry: vi.fn(), children });
    const buttons = screen.getAllByRole("button").map((b) => b.textContent);
    expect(buttons).toEqual(["Try again", "Back"]);
  });
});
