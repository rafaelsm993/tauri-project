import { describe, expect, it } from "vitest";
import { errorMessage } from "./errors";

describe("errorMessage", () => {
  it("returns string errors as-is (Tauri invoke rejects with strings)", () => {
    expect(errorMessage("Invalid API key", "fallback")).toBe("Invalid API key");
  });

  it("uses Error.message", () => {
    expect(errorMessage(new Error("boom"), "fallback")).toBe("boom");
  });

  it("falls back for anything else", () => {
    expect(errorMessage(undefined, "fallback")).toBe("fallback");
    expect(errorMessage({ code: 1 }, "fallback")).toBe("fallback");
    expect(errorMessage("", "fallback")).toBe("fallback");
  });

  it("hides the offline marker from the message", () => {
    expect(errorMessage("offline: error sending request", "fallback")).toBe(
      "error sending request",
    );
  });
});
