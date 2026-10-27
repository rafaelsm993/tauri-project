export function exposeSettings(container: HTMLElement) {
  container.querySelectorAll("details").forEach((node) => {
    node.open = true;
  });
  container.querySelectorAll("[popover]").forEach((node) => node.removeAttribute("popover"));
}
