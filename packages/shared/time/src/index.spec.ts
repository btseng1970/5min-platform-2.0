import { UtcTimestamp } from "./index";

describe("UtcTimestamp", () => {
  it("round-trips through an ISO string in UTC", () => {
    const iso = "2026-08-03T10:00:00.000Z";
    const ts = UtcTimestamp.fromIsoString(iso);
    expect(ts.toIsoString()).toBe(iso);
  });

  it("rejects an unparsable string", () => {
    expect(() => UtcTimestamp.fromIsoString("not-a-date")).toThrow(TypeError);
  });

  it("compares ordering correctly", () => {
    const earlier = UtcTimestamp.fromIsoString("2026-08-01T00:00:00.000Z");
    const later = UtcTimestamp.fromIsoString("2026-08-02T00:00:00.000Z");
    expect(earlier.isBefore(later)).toBe(true);
    expect(later.isAfter(earlier)).toBe(true);
  });

  it("now() uses the injected clock, not local wall time formatting", () => {
    const fixed = new Date("2026-08-03T12:34:56.000Z");
    const ts = UtcTimestamp.now(() => fixed);
    expect(ts.toIsoString()).toBe("2026-08-03T12:34:56.000Z");
  });
});
