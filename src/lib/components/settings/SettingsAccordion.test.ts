import { render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, expect, it, vi } from "vitest";
import SettingsAccordion from "./SettingsAccordion.svelte";

const route = vi.hoisted(() => ({ hash: "" }));
vi.mock("$app/state", () => ({
  page: {
    get url() {
      return new URL(route.hash, "https://sesh.test/settings");
    },
  },
}));
afterEach(() => (route.hash = ""));

it.each(["theme", "titles", "profile-artwork"])(
  "reveals the parent of #%s without relying on browser fragment disclosure",
  async (hash) => {
    route.hash = `#${hash}`;
    const { container } = render(SettingsAccordion, { title: "Parent", anchors: [hash] });
    await waitFor(() => expect(container.querySelector("details")!.open).toBe(true));
  },
);

it("starts collapsed with a real summary instead of a custom clickable div", () => {
  const { container } = render(SettingsAccordion, { title: "Theme" });
  const details = container.querySelector("details")!;
  expect(details.open).toBe(false);
  expect(details.querySelector("summary")).toHaveTextContent("Theme");
  expect(screen.getByRole("heading", { name: "Theme" })).toBeInTheDocument();
});

it("opens once by request and lets the user close it", async () => {
  const { container } = render(SettingsAccordion, { title: "Profile", initiallyOpen: true });
  const details = container.querySelector("details")!;
  expect(details.open).toBe(true);
  details.open = false;
  details.dispatchEvent(new Event("toggle"));
  await waitFor(() => expect(details.open).toBe(false));
});
