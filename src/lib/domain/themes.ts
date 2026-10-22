// Built-in palettes only (Q16): a theme is a set of channel overrides on the root, so every
// alpha composition in the app keeps working. No user-supplied colours.
export type Tokens = Record<string, string>;

export interface Palette {
  label: string;
  tokens: Tokens;
  // Packs re-skin surfaces, so each one belongs to a base theme; an accent suits both.
  base?: "light" | "dark";
}

// Nothing equipped: the base palette in global.css stands as written.
export const DEFAULT_ACCENT = "default";
export const DEFAULT_PACK = "default";

// An accent moves the primary pair only; surfaces and text stay with the chosen light/dark theme.
export const ACCENTS: Record<string, Palette> = {
  ember: {
    label: "Ember",
    tokens: {
      "--clr-primary-rgb": "199 102 18",
      "--clr-accent-rgb": "163 80 12",
      // Orange is a light surface: it needs dark text on it, not the default white.
      "--clr-on-primary-rgb": "28 18 8",
    },
  },
  dusk: {
    label: "Dusk",
    tokens: {
      "--clr-primary-rgb": "139 92 246",
      "--clr-accent-rgb": "109 66 208",
    },
  },
  ocean: {
    label: "Ocean",
    tokens: {
      "--clr-primary-rgb": "14 134 184",
      "--clr-accent-rgb": "10 103 142",
    },
  },
};

// A pack re-skins the surfaces; it is the heavier change, so it is further up the ladder.
export const PACKS: Record<string, Palette> = {
  sunrise: {
    label: "Sunrise",
    base: "dark",
    tokens: {
      "--clr-bg-rgb": "28 22 20",
      "--clr-surface-rgb": "38 29 26",
      "--clr-surface-2-rgb": "50 38 34",
      // A pack carries its own primary; an equipped accent overrides it.
      "--clr-primary-rgb": "188 94 40",
      "--clr-accent-rgb": "156 74 28",
      "--clr-on-primary-rgb": "255 246 240",
    },
  },
  midnight: {
    label: "Midnight",
    base: "dark",
    tokens: {
      "--clr-bg-rgb": "8 10 18",
      "--clr-surface-rgb": "14 17 28",
      "--clr-surface-2-rgb": "22 26 40",
      // A pack carries its own primary; an equipped accent overrides it.
      "--clr-primary-rgb": "99 132 214",
      "--clr-accent-rgb": "74 104 180",
    },
  },
};

// The pack lays the ground, the accent paints on top; an unknown id simply contributes nothing.
export function tokensFor(accent: string, pack: string): Tokens {
  return { ...(PACKS[pack]?.tokens ?? {}), ...(ACCENTS[accent]?.tokens ?? {}) };
}

// A palette pinned to one base must not be offered on the other: its surfaces would fight the text.
export const offerable = (palette: Palette, base: "light" | "dark"): boolean =>
  palette.base === undefined || palette.base === base;
