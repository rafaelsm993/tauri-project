import { describe, expect, it } from "vitest";
import { formatDate, formatDay, formatMinutes, formatRuntime, initials, plural } from "./format";

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

describe("formatDay", () => {
  it("shows a local YYYY-MM-DD as a short weekday and date, in any time zone", () => {
    expect(formatDay("2026-10-16")).toBe("Fri, Oct 16");
    expect(formatDay("2027-01-01")).toBe("Fri, Jan 1");
  });

  it("shows anything else unchanged", () => {
    expect(formatDay("soon")).toBe("soon");
  });
});

describe("formatMinutes", () => {
  it.each([
    [45, "45 min"],
    [60, "1 h"],
    [90, "1 h 30 min"],
    [600, "10 h"],
    [0, "0 min"],
  ])("%i minutes is %s", (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});
