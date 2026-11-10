import { describe, expect, it } from "vitest";
import { formatLtDateFromIso, todayIsoVilnius } from "@/lib/lt-date";

describe("formatLtDateFromIso", () => {
  it("formats a date in Lithuanian", () => {
    expect(formatLtDateFromIso("2026-11-10")).toBe("2026 m. lapkričio 10 d.");
    expect(formatLtDateFromIso("2026-06-16")).toBe("2026 m. birželio 16 d.");
    expect(formatLtDateFromIso("2026-03-01")).toBe("2026 m. kovo 1 d.");
  });

  it("rejects malformed or out-of-range dates", () => {
    expect(formatLtDateFromIso("")).toBeNull();
    expect(formatLtDateFromIso("10-11-2026")).toBeNull();
    expect(formatLtDateFromIso("2026-13-01")).toBeNull();
    expect(formatLtDateFromIso(null)).toBeNull();
  });
});

describe("todayIsoVilnius", () => {
  it("uses Vilnius time, not UTC", () => {
    // 22:30 UTC on 10 Nov is already 00:30 on 11 Nov in Vilnius
    expect(todayIsoVilnius(new Date("2026-11-10T22:30:00Z"))).toBe("2026-11-11");
  });
});
