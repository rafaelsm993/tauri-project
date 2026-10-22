import { prefsStore, type PrefsStore } from "$lib/stores/prefs.svelte";
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

// What the user has earned and what they have equipped. Reads `seen_level`, the highest level
// ever congratulated, so a level that later drops never takes a reward away (Q14).
export class UnlocksStore {
  private prefs: PrefsStore;

  constructor(prefs: PrefsStore = prefsStore) {
    this.prefs = prefs;
  }

  get seenLevel(): number {
    return this.prefs.ready ? this.prefs.prefs.seen_level : 0;
  }

  get unlocked(): Unlock[] {
    return UNLOCKS.filter((u) => isUnlocked(u.id, this.seenLevel));
  }

  get locked(): Unlock[] {
    return UNLOCKS.filter((u) => !isUnlocked(u.id, this.seenLevel));
  }

  get next(): Unlock | null {
    return nextUnlock(this.seenLevel);
  }

  // `system` is resolved by the document; for offer rules treat it as dark, the app's default.
  get baseTheme(): "light" | "dark" {
    return this.prefs.prefs.theme === "light" ? "light" : "dark";
  }

  // An id only counts if it is both unlocked and suitable for the current base theme.
  private live(id: string, set: Record<string, Palette>): string {
    const palette = set[id];
    if (!palette || !isUnlocked(id as UnlockId, this.seenLevel)) return "default";
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
    return isUnlocked(id as UnlockId, this.seenLevel) ? id : "default";
  }

  // The garden slot holds one reward, so prefs store it as the motif-style id or "default".
  get garden(): string {
    const id = this.prefs.prefs.garden;
    return isUnlocked(id as UnlockId, this.seenLevel) ? id : "default";
  }

  get tokens(): Tokens {
    return tokensFor(this.accent, this.pack);
  }

  canEquip(slot: Slot, id: string): boolean {
    if (id === "default") return true;
    if (!isUnlocked(id as UnlockId, this.seenLevel)) return false;
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
