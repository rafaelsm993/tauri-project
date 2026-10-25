import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import RewardPreview from "./RewardPreview.svelte";

describe("RewardPreview", () => {
  it("names a static local preview without repainting the document", () => {
    const before = document.documentElement.style.cssText;
    render(RewardPreview, { slot: "accent", reward: "ember", label: "Ember" });
    const preview = screen.getByRole("img", { name: "Ember preview" });
    expect(preview.getAttribute("style")).toContain("--preview-primary-rgb: 199 102 18");
    expect(preview.querySelectorAll("animate")).toHaveLength(0);
    expect(document.documentElement.style.cssText).toBe(before);
  });
});
