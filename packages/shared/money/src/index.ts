// Integer-only value objects for points and money. float/double are never
// used to represent a monetary or point quantity anywhere in this repository
// (CLAUDE.md GA block: 金額與點數用整數最小單位，全面禁止 float/double).
//
// Deliberately no constructor parameter properties anywhere in this file:
// that syntax is not "erasable" TypeScript (it requires generating an
// assignment, not just removing a type), so Node's native type-stripping
// loader cannot run it when this package is require()'d at runtime by a
// consumer whose own build step does not re-transpile external packages.

function assertSafeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
    throw new TypeError(`${label} must be a safe integer, got ${value}`);
  }
}

export class Points {
  private readonly minorUnits: number;

  private constructor(minorUnits: number) {
    this.minorUnits = minorUnits;
  }

  static of(minorUnits: number): Points {
    assertSafeInteger(minorUnits, "Points");
    if (minorUnits < 0) {
      throw new RangeError(`Points cannot be negative, got ${minorUnits}`);
    }
    return new Points(minorUnits);
  }

  static zero(): Points {
    return new Points(0);
  }

  add(other: Points): Points {
    return Points.of(this.minorUnits + other.minorUnits);
  }

  subtract(other: Points): Points {
    return Points.of(this.minorUnits - other.minorUnits);
  }

  isGreaterThanOrEqual(other: Points): boolean {
    return this.minorUnits >= other.minorUnits;
  }

  toMinorUnits(): number {
    return this.minorUnits;
  }
}

export class Money {
  private readonly minorUnits: number;
  private readonly currency: string;

  private constructor(minorUnits: number, currency: string) {
    this.minorUnits = minorUnits;
    this.currency = currency;
  }

  static of(minorUnits: number, currency: string): Money {
    assertSafeInteger(minorUnits, "Money");
    if (currency.trim() === "") {
      throw new RangeError("Money currency must not be blank");
    }
    return new Money(minorUnits, currency);
  }

  toMinorUnits(): number {
    return this.minorUnits;
  }

  getCurrency(): string {
    return this.currency;
  }
}
