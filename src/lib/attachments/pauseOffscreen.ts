import type { Attachment } from "svelte/attachments";

// Marks the element `data-offscreen` while it is out of view, so CSS can pause its loops.
export const pauseOffscreen: Attachment<Element> = (el) => {
  if (typeof IntersectionObserver === "undefined") return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) e.target.toggleAttribute("data-offscreen", !e.isIntersecting);
  });
  io.observe(el);
  return () => io.disconnect();
};
