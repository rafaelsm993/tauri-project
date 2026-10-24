import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import SessionPicker from "./SessionPicker.svelte";
import type { SessionChoice, SessionScale } from "$lib/domain/sessionScale";

const EPISODES: SessionScale = {
  kind: "units",
  step: 24,
  steps: 25,
  min: 24,
  noun: "episode",
  full: "Full episode",
  pages: false,
};
const BOOK: SessionScale = {
  kind: "time",
  step: 30,
  steps: 20,
  min: 30,
  noun: "",
  full: null,
  pages: true,
};

function setup(scale: SessionScale, start: Partial<SessionChoice> = {}) {
  const props = $state({
    scale,
    choice: { count: 1, custom: false, typed: scale.step, ...start } as SessionChoice,
    label: "Up to, per session",
    pagesPerHour: 30,
  });
  render(SessionPicker, props);
  return props;
}

const group = () => screen.getByRole("group", { name: "Up to, per session" });

describe("SessionPicker", () => {
  it("centres one full episode with arrows, and never goes below one", async () => {
    const props = setup(EPISODES);
    const centre = within(group()).getByRole("button", { name: "Full episode 24 min" });
    expect(centre).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Fewer episodes" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "More episodes" }));
    expect(props.choice.count).toBe(2);
    expect(within(group()).getByRole("button", { name: "2 episodes 48 min" })).toBeInTheDocument();
    await userEvent.click(within(group()).getByRole("button", { name: "2 episodes 48 min" }));
    expect(props.choice.count).toBe(1);
  });

  it("Custom types minutes in the centre and shows the episodes they are worth", async () => {
    const props = setup(EPISODES);
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    const input = within(group()).getByLabelText("Minutes per session");
    expect(input).toHaveFocus();
    expect(input).toHaveValue(24);
    await userEvent.clear(input);
    await userEvent.type(input, "50");
    expect(props.choice).toEqual({ count: 1, custom: true, typed: 50 });
    expect(group()).toHaveTextContent("≈ 2 episodes");
    await userEvent.clear(input);
    await userEvent.type(input, "20");
    expect(group()).toHaveTextContent("At least one episode (24 min).");
  });

  it("the arrows leave Custom from its nearest whole episodes", async () => {
    const props = setup(EPISODES, { custom: true, typed: 50 });
    await userEvent.click(screen.getByRole("button", { name: "More episodes" }));
    expect(props.choice).toMatchObject({ count: 3, custom: false });
    expect(within(group()).queryByLabelText("Minutes per session")).not.toBeInTheDocument();
  });

  it("tapping Custom again goes back to the nearest whole episodes", async () => {
    const props = setup(EPISODES, { custom: true, typed: 70 });
    expect(screen.getByRole("button", { name: "Custom" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Custom" }));
    expect(props.choice).toMatchObject({ count: 3, custom: false });
  });

  it("stops at the last step", () => {
    setup({ ...EPISODES, steps: 1 });
    expect(screen.getByRole("button", { name: "More episodes" })).toBeDisabled();
  });

  it("steps a book by 30 minutes and shows the pages, with a plain centre", async () => {
    const props = setup(BOOK, { count: 2, typed: 60 });
    expect(group()).toHaveTextContent("1 h");
    expect(group()).toHaveTextContent("≈ 30 pages");
    expect(within(group()).queryByRole("button", { name: /^1 h/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "30 min more" }));
    expect(props.choice.count).toBe(3);
    expect(group()).toHaveTextContent("≈ 45 pages");
    await userEvent.click(screen.getByRole("button", { name: "30 min less" }));
    await userEvent.click(screen.getByRole("button", { name: "30 min less" }));
    expect(screen.getByRole("button", { name: "30 min less" })).toBeDisabled();
  });
});
