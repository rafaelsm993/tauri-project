import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import LengthFields from "./LengthFields.svelte";
import { emptyLength } from "$lib/domain/length";
import type { MediaType } from "$lib/types/media";

function setup(mediaType: MediaType, fields = ["episodes", "episode_minutes"] as const) {
  const props = $state({ mediaType, fields: [...fields], length: emptyLength() });
  render(LengthFields, props);
  return props;
}

const presets = () =>
  within(screen.getByRole("group", { name: "Common episode lengths" }))
    .getAllByRole("button")
    .map((b) => b.textContent?.trim());

describe("LengthFields", () => {
  it("offers typical episode lengths for a TV show", () => {
    setup("tv");
    expect(presets()).toEqual(["22 min", "30 min", "45 min", "60 min"]);
  });

  it("offers typical episode lengths for an anime", () => {
    setup("anime");
    expect(presets()).toEqual(["12 min", "24 min"]);
  });

  it("fills minutes per episode from a tapped length and marks it chosen", async () => {
    const props = setup("tv");
    await userEvent.click(screen.getByRole("button", { name: "45 min" }));
    expect(screen.getByLabelText("Minutes per episode")).toHaveValue(45);
    expect(props.length.episode_minutes).toBe(45);
    expect(screen.getByRole("button", { name: "45 min" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "22 min" })).toHaveAttribute("aria-pressed", "false");
  });

  it("marks none for a typed length that is not a preset, and the match for one that is", async () => {
    setup("tv");
    const field = screen.getByLabelText("Minutes per episode");
    await userEvent.type(field, "50");
    expect(screen.queryByRole("button", { pressed: true })).not.toBeInTheDocument();
    await userEvent.clear(field);
    await userEvent.type(field, "30");
    expect(screen.getByRole("button", { pressed: true })).toHaveTextContent("30 min");
  });

  it("offers nothing when minutes per episode is not asked, as when only the count is missing", () => {
    setup("tv", ["episodes"] as never);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });

  it("offers nothing for lengths without a typical value", () => {
    setup("movie", ["runtime_minutes"] as never);
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
