import { render, screen, cleanup } from "@testing-library/svelte";
import { it, expect } from "vitest";
import WelcomeIllustration from "./WelcomeIllustration.svelte";
it.each(["garden", "planner", "pace", "manual"] as const)(
  "renders a labelled inert %s example",
  (beat) => {
    const { container } = render(WelcomeIllustration, { beat });
    expect(screen.getByRole("img", { name: `${beat} example — preview only` })).toBeInTheDocument();
    expect(container.querySelector("[inert][aria-hidden=true]")).not.toBeNull();
    expect(container.querySelector("dialog")).toBeNull();
    expect(container.querySelector("img[src]")).toBeNull();
    cleanup();
  },
);
