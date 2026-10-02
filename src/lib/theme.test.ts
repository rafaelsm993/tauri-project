import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, THEME_KEY } from "./theme";

const root = document.documentElement;

type Listener = () => void;

function fakeSystem(prefersLight: boolean) {
  const listeners: Listener[] = [];
  const query = {
    matches: prefersLight,
    addEventListener: (_: string, fn: Listener) => listeners.push(fn),
  };
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => query),
  );
  return {
    flip(light: boolean) {
      query.matches = light;
      listeners.forEach((fn) => fn());
    },
  };
}

function fakeBars() {
  const setLightBars = vi.fn();
  vi.stubGlobal("AevumSystemBars", { setLightBars });
  return setLightBars;
}

afterEach(() => {
  delete root.dataset.theme;
  root.style.colorScheme = "";
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("applyTheme", () => {
  it("marks the document and tells form controls which scheme to draw", () => {
    applyTheme("light");
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
    applyTheme("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(root.style.colorScheme).toBe("dark");
  });

  it("lets the system pick when following it", () => {
    applyTheme("system");
    expect(root.dataset.theme).toBe("system");
    expect(root.style.colorScheme).toBe("light dark");
  });

  it("remembers the choice so the next launch paints it before the prefs load", () => {
    applyTheme("light");
    expect(localStorage.getItem(THEME_KEY)).toBe("light");
  });

  it("still applies the theme when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    applyTheme("light");
    expect(root.dataset.theme).toBe("light");
  });
});

// The module watches the device scheme once, so every case gets a fresh copy.
async function freshApply() {
  vi.resetModules();
  return (await import("./theme")).applyTheme;
}

describe("Android system bars", () => {
  it("asks for dark status-bar icons on the light theme and light ones on the dark theme", async () => {
    fakeSystem(false);
    const setLightBars = fakeBars();
    const applyTheme = await freshApply();
    applyTheme("light");
    expect(setLightBars).toHaveBeenLastCalledWith(true);
    applyTheme("dark");
    expect(setLightBars).toHaveBeenLastCalledWith(false);
  });

  it("follows the device when the theme follows the system, and keeps following it", async () => {
    const system = fakeSystem(true);
    const setLightBars = fakeBars();
    const applyTheme = await freshApply();
    applyTheme("system");
    expect(setLightBars).toHaveBeenLastCalledWith(true);
    system.flip(false);
    expect(setLightBars).toHaveBeenLastCalledWith(false);
  });

  it("stops following the device once a theme is chosen", async () => {
    const system = fakeSystem(true);
    const setLightBars = fakeBars();
    const applyTheme = await freshApply();
    applyTheme("system");
    applyTheme("dark");
    system.flip(true);
    expect(setLightBars).toHaveBeenLastCalledWith(false);
  });

  it("does nothing off Android, where the bridge is absent", async () => {
    fakeSystem(true);
    const applyTheme = await freshApply();
    expect(() => applyTheme("light")).not.toThrow();
    expect(root.dataset.theme).toBe("light");
  });
});
