// Background art as data: a motif knows how to lay out N particles, and the component renders
// them as custom properties. Replaces twenty hand-written nth-child blocks.
export const MAX_PARTICLES = 20;

export interface Particle {
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
}

// The numeric envelope a motif's particles are drawn from.
interface Spread {
  size: [number, number];
  duration: [number, number];
  delay: [number, number];
  opacity: [number, number];
}

export interface Motif {
  label: string;
  keyframe: string;
  spread: Spread;
}

// A cheap deterministic hash: particle i always lands in the same place, so raising the count
// adds to the scene instead of reshuffling it.
function unit(seed: string, i: number, salt: number): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let c = 0; c < seed.length; c++) {
    h = Math.imul(h ^ seed.charCodeAt(c), 16777619);
  }
  h = Math.imul(h ^ i, 16777619);
  h ^= h >>> 15;
  return ((h >>> 0) % 1000) / 1000;
}

const lerp = (range: [number, number], t: number): number => range[0] + (range[1] - range[0]) * t;

const round2 = (n: number): number => Math.round(n * 100) / 100;

export const MOTIFS: Record<string, Motif> = {
  bubbles: {
    label: "Bubbles",
    keyframe: "motif-rise",
    spread: {
      size: [14, 90],
      duration: [7, 18],
      delay: [0, 8],
      opacity: [0.07, 0.16],
    },
  },
  embers: {
    label: "Embers",
    keyframe: "motif-ember",
    spread: {
      size: [4, 14],
      duration: [5, 12],
      delay: [0, 6],
      opacity: [0.2, 0.5],
    },
  },
  aurora: {
    label: "Aurora",
    keyframe: "motif-drift",
    spread: {
      size: [80, 120],
      duration: [24, 40],
      delay: [0, 12],
      opacity: [0.05, 0.12],
    },
  },
};

export function motifById(id: string): Motif | null {
  return MOTIFS[id] ?? null;
}

// The particles to draw for an equipped motif at the user's chosen count.
export function particlesFor(id: string, count: number): Particle[] {
  const motif = motifById(id);
  if (!motif) return [];
  const wanted = Math.min(Math.floor(count), MAX_PARTICLES);
  const { spread } = motif;
  return Array.from({ length: wanted }, (_, i) => ({
    left: round2(unit(id, i, 1) * 100),
    size: Math.round(lerp(spread.size, unit(id, i, 2))),
    duration: round2(lerp(spread.duration, unit(id, i, 3))),
    delay: round2(lerp(spread.delay, unit(id, i, 4))),
    opacity: round2(lerp(spread.opacity, unit(id, i, 5))),
  }));
}
