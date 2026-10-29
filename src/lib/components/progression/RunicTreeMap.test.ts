import { render } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import RunicTreeMap from "./RunicTreeMap.svelte";
import type { TreeMapNode } from "$lib/domain/progressionTree";

const NODES: TreeMapNode[] = [
  { id: "a", label: "Root", title: "Root", caption: "1 completed", x: 50, y: 20, available: true },
  { id: "b", label: "Next", title: "Next", caption: "5 completed", x: 25, y: 48, available: true },
  { id: "c", label: "Far", title: "Far", caption: "10 completed", x: 75, y: 76, available: false },
];

const accessible = (el: HTMLElement) =>
  [...el.querySelectorAll("button, [role], [aria-label]")].map((n) => [
    n.tagName,
    n.getAttribute("role"),
    n.getAttribute("aria-label"),
    (n as HTMLElement).style.left,
    (n as HTMLElement).style.top,
  ]);

describe("RunicTreeMap starlight", () => {
  for (const media of [false, true]) {
    it(`keeps the same tree with and without starlight (media=${media})`, () => {
      const still = render(RunicTreeMap, { nodes: NODES, media, onselect: vi.fn() });
      const lit = render(RunicTreeMap, { nodes: NODES, media, reveal: true, onselect: vi.fn() });
      expect(accessible(lit.container)).toEqual(accessible(still.container));
    });
  }

  it("draws starlight only while revealed, and only on reached journey edges", () => {
    const still = render(RunicTreeMap, { nodes: NODES, media: true, onselect: vi.fn() });
    expect(still.container.querySelectorAll(".channel-spark")).toHaveLength(0);
    const lit = render(RunicTreeMap, {
      nodes: NODES,
      media: true,
      reveal: true,
      onselect: vi.fn(),
    });
    const sparks = lit.container.querySelectorAll(".channel-spark");
    const earned = lit.container.querySelectorAll(".journey-edge.earned");
    expect(earned.length).toBeGreaterThan(0);
    expect(sparks.length).toBe(earned.length);
    sparks.forEach((s) => expect(s.closest("svg")).toHaveAttribute("aria-hidden", "true"));
  });

  it("runs starlight along the main channels too", () => {
    const { container } = render(RunicTreeMap, { nodes: NODES, reveal: true, onselect: vi.fn() });
    expect(container.querySelectorAll(".channel-spark")).toHaveLength(1);
  });

  it("orders seals top to bottom and joins the shared beat", () => {
    const { container } = render(RunicTreeMap, { nodes: NODES, reveal: true, onselect: vi.fn() });
    const orders = [...container.querySelectorAll<HTMLElement>(".map-node")].map((n) =>
      n.style.getPropertyValue("--order"),
    );
    expect(orders).toEqual(["2", "5", "8"]);
    expect(
      container.querySelector<HTMLElement>(".runic-map")!.style.getPropertyValue("--beat-delay"),
    ).toMatch(/^(0|-\d+)ms$/);
  });

  it("lights a media subtree from its root at the bottom upwards", () => {
    const { container } = render(RunicTreeMap, {
      nodes: NODES,
      media: true,
      reveal: true,
      onselect: vi.fn(),
    });
    const orders = [...container.querySelectorAll<HTMLElement>(".map-node")].map((n) =>
      n.style.getPropertyValue("--order"),
    );
    expect(orders).toEqual(["8", "5", "2"]);
  });
});
