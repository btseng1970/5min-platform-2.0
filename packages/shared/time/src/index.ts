// UTC-only timestamp helpers. No local-timezone arithmetic is ever performed
// anywhere in this repository (CLAUDE.md GA block: 所有時間比較用 UTC，
// 禁止 local timezone 運算). All comparisons operate on the UTC epoch millis
// underlying a Date; formatting always uses toISOString() (UTC, "Z" suffix).

// No constructor parameter properties (not erasable TypeScript syntax — see
// packages/shared/money/src/index.ts's comment for why this matters at
// runtime for an externally require()'d workspace package).
export class UtcTimestamp {
  private readonly epochMillis: number;

  private constructor(epochMillis: number) {
    this.epochMillis = epochMillis;
  }

  static now(clock: () => Date = () => new Date()): UtcTimestamp {
    return new UtcTimestamp(clock().getTime());
  }

  static fromDate(date: Date): UtcTimestamp {
    return new UtcTimestamp(date.getTime());
  }

  static fromIsoString(iso: string): UtcTimestamp {
    const parsed = Date.parse(iso);
    if (Number.isNaN(parsed)) {
      throw new TypeError(`Not a valid ISO 8601 timestamp: ${iso}`);
    }
    return new UtcTimestamp(parsed);
  }

  toIsoString(): string {
    return new Date(this.epochMillis).toISOString();
  }

  toEpochMillis(): number {
    return this.epochMillis;
  }

  isBefore(other: UtcTimestamp): boolean {
    return this.epochMillis < other.epochMillis;
  }

  isAfter(other: UtcTimestamp): boolean {
    return this.epochMillis > other.epochMillis;
  }
}
