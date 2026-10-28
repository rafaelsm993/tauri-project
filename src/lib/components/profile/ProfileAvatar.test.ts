import { render, screen } from "@testing-library/svelte";
import { it, expect } from "vitest";
import ProfileAvatar from "./ProfileAvatar.svelte";
it("uses the same glyph for Default and unknown IDs", async () => {
  const { container, rerender } = render(ProfileAvatar, { art: "default", size: 32, scale: 2 });
  expect(screen.getByRole("img", { name: "Default avatar" })).toHaveAttribute("width", "64");
  expect(container.querySelector(".default-avatar path")).toHaveAttribute(
    "d",
    expect.stringMatching(/^M12 12.+M4 21/),
  );
  await rerender({ art: "unknown:1", size: 32, scale: 2 });
  expect(container.querySelectorAll(".default-avatar")).toHaveLength(1);
});
it("reuses real artwork and can be decorative", async () => {
  const { container, rerender } = render(ProfileAvatar, { art: "movie:1" });
  expect(screen.getByRole("img", { name: "Silver Screen artwork" })).toBeInTheDocument();
  await rerender({ art: "movie:1", decorative: true });
  expect(container.querySelector(".profile-artwork")).toHaveAttribute("aria-hidden", "true");
});
