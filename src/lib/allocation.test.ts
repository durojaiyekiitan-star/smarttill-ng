import { describe, it, expect } from "vitest";
import { aggregateStatus, splitAmount, validatePercentages } from "./allocation";
import { formatMinor } from "./money";

describe("splitAmount", () => {
  it("70/30 of 10,000 units", () => {
    expect(splitAmount(10000n, 30)).toEqual({ reserve: 7000n, owner: 3000n });
  });
  it("60/40", () => {
    expect(splitAmount(10000n, 40)).toEqual({ reserve: 6000n, owner: 4000n });
  });
  it("50/50", () => {
    expect(splitAmount(10000n, 50)).toEqual({ reserve: 5000n, owner: 5000n });
  });
  it("rounds owner down, reserve takes the remainder, total is preserved", () => {
    const r = splitAmount(333n, 30);
    expect(r.owner).toBe(99n);
    expect(r.reserve).toBe(234n);
    expect(r.reserve + r.owner).toBe(333n);
  });
  it("tiny amounts never lose a unit", () => {
    expect(splitAmount(1n, 30)).toEqual({ reserve: 1n, owner: 0n });
  });
  it("handles very large values without float error", () => {
    const big = 123456789012345678901234567890n;
    const r = splitAmount(big, 30);
    expect(r.reserve + r.owner).toBe(big);
  });
});

describe("validatePercentages", () => {
  it("accepts 70/30", () => expect(validatePercentages(70, 30).ok).toBe(true));
  it("rejects totals not equal to 100", () => expect(validatePercentages(70, 20).ok).toBe(false));
  it("rejects out of range, zero, negative, decimals and non-numbers", () => {
    expect(validatePercentages(100, 0).ok).toBe(false);
    expect(validatePercentages(0, 100).ok).toBe(false);
    expect(validatePercentages(-10, 110).ok).toBe(false);
    expect(validatePercentages(70.5, 29.5).ok).toBe(false);
    expect(validatePercentages("70", 30).ok).toBe(false);
    expect(validatePercentages(NaN, 30).ok).toBe(false);
  });
});

describe("formatMinor (asset scale)", () => {
  it("formats by scale", () => {
    expect(formatMinor("1000", 2)).toBe("10.00");
    expect(formatMinor("5", 2)).toBe("0.05");
    expect(formatMinor("1234567", 0)).toBe("1,234,567");
    expect(formatMinor("123456789", 9)).toBe("0.123456789");
  });
});

describe("aggregateStatus", () => {
  it("completed / partial / failed / processing", () => {
    expect(aggregateStatus(["completed", "completed"])).toBe("completed");
    expect(aggregateStatus(["completed", "skipped"])).toBe("completed");
    expect(aggregateStatus(["completed", "failed"])).toBe("partial");
    expect(aggregateStatus(["failed", "failed"])).toBe("failed");
    expect(aggregateStatus(["completed", "processing"])).toBe("processing");
    expect(aggregateStatus(["failed", "processing"])).toBe("processing");
  });
});
