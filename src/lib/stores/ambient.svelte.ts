// "Is anyone looking?": hidden or unfocused windows pause every ambient loop at once.
export class AmbientStore {
  hidden = $state(false);
  blurred = $state(false);

  get away(): boolean {
    return this.hidden || this.blurred;
  }

  // Starts listening and returns the cleanup; the owner calls it from an $effect.
  watch(): () => void {
    this.hidden = document.hidden;
    this.blurred = !document.hasFocus();
    const visibility = () => (this.hidden = document.hidden);
    const blur = () => (this.blurred = true);
    const focus = () => (this.blurred = false);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", blur);
    window.addEventListener("focus", focus);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", blur);
      window.removeEventListener("focus", focus);
    };
  }
}

export const ambientStore = new AmbientStore();
