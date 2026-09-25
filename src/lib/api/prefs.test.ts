import { afterEach, describe, expect, it } from "vitest";
import { clearMocks, mockIPC } from "@tauri-apps/api/mocks";
import { prefs } from "./prefs";

afterEach(() => clearMocks());

function record(reply: unknown) {
  const calls: Array<{ cmd: string; args: unknown }> = [];
  mockIPC((cmd, args) => {
    calls.push({ cmd, args });
    return reply;
  });
  return calls;
}

describe("prefs client", () => {
  it("load calls prefs_load with no arguments", async () => {
    const calls = record({ background_animation: true });
    expect(await prefs.load()).toEqual({ background_animation: true });
    expect(calls).toEqual([{ cmd: "prefs_load", args: {} }]);
  });

  it("update sends only the changed fields as `patch`", async () => {
    const calls = record({ background_animation: false });
    await prefs.update({ background_animation: false });
    expect(calls).toEqual([
      { cmd: "prefs_update", args: { patch: { background_animation: false } } },
    ]);
  });
});
