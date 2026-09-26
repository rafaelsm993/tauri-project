import { describe, expect, it } from "vitest";
import { formatDate, formatRuntime, initials, plural } from "./format";

describe("plural", () => {
  it("adds an s except for one", () => {
    expect(plural(1, "item")).toBe("1 item");
    expect(plural(0, "poster")).toBe("0 posters");
    expect(plural(3, "activity record")).toBe("3 activity records");
  });
});

describe("formatDate", () => {
  it("shows an ISO timestamp as an English date", () => {
    expect(formatDate("2026-09-20T10:00:00.000Z")).toBe("Sep 20, 2026");
  });

  it("returns an unreadable value as is", () => {
    expect(formatDate("yesterday")).toBe("yesterday");
  });
});

describe("initials", () => {
  it("takes first + last initial, uppercased", () => {
    expect(initials("keanu charles reeves")).toBe("KR");
  });

  it("takes two letters from a single name", () => {
    expect(initials("Zendaya")).toBe("ZE");
  });

  it("returns ? for blank names", () => {
    expect(initials("   ")).toBe("?");
  });
});

describe("formatRuntime", () => {
  it("formats minutes as h/m", () => {
    expect(formatRuntime(128, "movie")).toBe("2h 8m");
  });

  it("formats books as pages", () => {
    expect(formatRuntime(320, "book")).toBe("320 pages");
  });

  it("is empty when unknown", () => {
    expect(formatRuntime(null, "movie")).toBe("");
    expect(formatRuntime(0, "game")).toBe("");
  });
});
