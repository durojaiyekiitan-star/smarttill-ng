export type Role = "reserve" | "owner";
export type LegStatus = "pending" | "processing" | "completed" | "failed" | "skipped";
export type OverallStatus = "pending" | "processing" | "completed" | "partial" | "failed";

export type PercentResult =
  | { ok: true; reserve: number; owner: number }
  | { ok: false; error: string };

/** Both values must be whole numbers from 1 to 99 and add up to exactly 100. */
export function validatePercentages(reserve: unknown, owner: unknown): PercentResult {
  if (typeof reserve !== "number" || typeof owner !== "number") {
    return { ok: false, error: "Percentages must be numbers." };
  }
  if (!Number.isInteger(reserve) || !Number.isInteger(owner)) {
    return { ok: false, error: "Percentages must be whole numbers." };
  }
  if (reserve < 1 || reserve > 99 || owner < 1 || owner > 99) {
    return { ok: false, error: "Each percentage must be between 1 and 99." };
  }
  if (reserve + owner !== 100) {
    return { ok: false, error: "Percentages must add up to exactly 100." };
  }
  return { ok: true, reserve, owner };
}

/**
 * Splits an amount in minor units. The owner share is rounded down and the Business Reserve
 * receives the remainder, so reserve + owner always equals the received amount exactly.
 */
export function splitAmount(total: bigint, ownerPercent: number): Record<Role, bigint> {
  if (total < 0n) throw new Error("Amount cannot be negative");
  if (!Number.isInteger(ownerPercent) || ownerPercent < 0 || ownerPercent > 100) {
    throw new Error("Invalid owner percentage");
  }
  const owner = (total * BigInt(ownerPercent)) / 100n;
  return { reserve: total - owner, owner };
}

/** Overall status of a transaction from the statuses of its transfer legs. */
export function aggregateStatus(legs: LegStatus[]): OverallStatus {
  if (legs.length === 0) return "pending";
  if (legs.some((l) => l === "pending" || l === "processing")) return "processing";
  const sent = legs.filter((l) => l === "completed").length;
  const failed = legs.filter((l) => l === "failed").length;
  if (failed === 0) return "completed"; // all completed or skipped
  if (sent === 0) return "failed";
  return "partial";
}
