import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
import { gamificationStore } from "$lib/stores/gamification.svelte";
import { libraryStore } from "$lib/stores/library.svelte";
import { MediaQuery } from "svelte/reactivity";
import { completionAchievements, effectiveProfileArt } from "$lib/domain/completionAchievements";
import type { LibraryEntry } from "$lib/types/library";
import {
  ACCENTS,
  PACKS,
  offerable,
  tokensFor,
  type Palette,
  type Tokens,
} from "$lib/domain/themes";
import { UNLOCKS, isUnlocked, nextUnlock, type Unlock, type UnlockId } from "$lib/domain/unlocks";

export type Slot = "accent" | "pack" | "motif" | "garden";

const systemLight =
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? new MediaQuery("prefers-color-scheme: light")
    : { current: false };

// Current eligibility changes the display without rewriting stored selections.
export class UnlocksStore {
  private prefs: PrefsStore;

  constructor(
    prefs: PrefsStore = prefsStore,
    private currentLevel: () => number | null = () =>
      libraryStore.ready && gamificationStore.loaded ? gamificationStore.level.level : null,
    private currentEntries: () => LibraryEntry[] | null = () =>
      libraryStore.ready ? libraryStore.entries : null,
  ) {
    this.prefs = prefs;
  }

  get level(): number {
    return this.prefs.loaded ? (this.currentLevel() ?? 0) : 0;
  }

  get unlocked(): Unlock[] {
    return UNLOCKS.filter((u) => isUnlocked(u.id, this.level));
  }

  get locked(): Unlock[] {
    return UNLOCKS.filter((u) => !isUnlocked(u.id, this.level));
  }

  get next(): Unlock | null {
    return nextUnlock(this.level);
  }

  // Palette suitability follows the same live system preference as the document.
  get baseTheme(): "light" | "dark" {
    const theme = this.prefs.prefs.theme;
    return theme === "light" || (theme === "system" && systemLight.current) ? "light" : "dark";
  }

  // An id only counts if it is both unlocked and suitable for the current base theme.
  private live(id: string, set: Record<string, Palette>): string {
    const palette = set[id];
    if (!palette || !isUnlocked(id as UnlockId, this.level)) return "default";
    return offerable(palette, this.baseTheme) ? id : "default";
  }

  get accent(): string {
    return this.live(this.prefs.prefs.accent, ACCENTS);
  }

  get pack(): string {
    return this.live(this.prefs.prefs.pack, PACKS);
  }

  get motif(): string {
    const id = this.prefs.prefs.motif;
    return isUnlocked(id, this.level, "motif") ? id : "default";
  }

  // The legacy garden slot holds Runic shimmer without migrating saved choices.
  get garden(): string {
    const id = this.prefs.prefs.garden;
    return isUnlocked(id, this.level, "garden") ? id : "default";
  }

  get tokens(): Tokens {
    return tokensFor(this.accent, this.pack);
  }

  get artRewards() {
    return completionAchievements(this.currentEntries() ?? [], this.level);
  }

  get profileArt(): string {
    return effectiveProfileArt(
      this.prefs.prefs.profile_art,
      this.currentEntries() ?? [],
      this.level,
    );
  }

  canEquipArt(id: string): boolean {
    return (
      this.prefs.loaded &&
      (id === "default" || this.artRewards.some((art) => art.id === id && art.unlocked))
    );
  }

  async equipArt(id: string): Promise<boolean> {
    return this.canEquipArt(id) ? this.prefs.update({ profile_art: id }) : false;
  }

  canEquip(slot: Slot, id: string): boolean {
    if (id === "default") return true;
    if (!isUnlocked(id, this.level, slot)) return false;
    const set = slot === "accent" ? ACCENTS : slot === "pack" ? PACKS : null;
    const palette = set?.[id];
    return palette ? offerable(palette, this.baseTheme) : set === null;
  }

  async equip(slot: Slot, id: string): Promise<void> {
    if (!this.canEquip(slot, id)) return;
    await this.prefs.update({ [slot]: id });
  }
}

export const unlocksStore = new UnlocksStore();
