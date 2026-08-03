import { Money, Points } from "./index";

describe("Points", () => {
  it("accepts a non-negative safe integer", () => {
    expect(Points.of(500).toMinorUnits()).toBe(500);
  });

  it("rejects a non-integer value", () => {
    expect(() => Points.of(1.5)).toThrow(TypeError);
  });

  it("rejects a negative value", () => {
    expect(() => Points.of(-1)).toThrow(RangeError);
  });

  it("add/subtract stay integer and correct", () => {
    const a = Points.of(300);
    const b = Points.of(120);
    expect(a.add(b).toMinorUnits()).toBe(420);
    expect(a.subtract(b).toMinorUnits()).toBe(180);
  });

  it("subtract below zero throws", () => {
    const a = Points.of(10);
    const b = Points.of(20);
    expect(() => a.subtract(b)).toThrow(RangeError);
  });

  it("isGreaterThanOrEqual compares correctly", () => {
    expect(Points.of(100).isGreaterThanOrEqual(Points.of(100))).toBe(true);
    expect(Points.of(99).isGreaterThanOrEqual(Points.of(100))).toBe(false);
  });
});

describe("Money", () => {
  it("accepts an integer minor-unit amount with a currency", () => {
    const money = Money.of(1999, "TWD");
    expect(money.toMinorUnits()).toBe(1999);
    expect(money.getCurrency()).toBe("TWD");
  });

  it("rejects a non-integer amount", () => {
    expect(() => Money.of(19.99, "TWD")).toThrow(TypeError);
  });

  it("rejects a blank currency", () => {
    expect(() => Money.of(100, "  ")).toThrow(RangeError);
  });
});
