import { aggregateStatus, splitAmount, type LegStatus, type OverallStatus, type Role } from "./allocation";

/** Thrown ONLY when we are certain no outgoing payment was created (safe to retry later). */
export class NotSentError extends Error {}

export interface LegOutcome {
  status: LegStatus;
  opUrl?: string;
  quoteId?: string;
  sentValue?: string;
  receivedValue?: string;
  error?: string;
}

export interface Ports {
  /** Atomically moves pending -> processing. Returns false if someone else already claimed it. */
  claim(incomingId: string): Promise<boolean>;
  getLegStatuses(incomingId: string): Promise<Partial<Record<Role, LegStatus>>>;
  upsertLeg(incomingId: string, role: Role, data: { debit: bigint } & Partial<LegOutcome>): Promise<void>;
  sendLeg(role: Role, debit: bigint): Promise<LegOutcome>;
  setIncomingStatus(incomingId: string, status: OverallStatus): Promise<void>;
  audit(event: string, detail?: unknown): Promise<void>;
}

const ROLES: Role[] = ["reserve", "owner"];

export async function allocateIncoming(
  ports: Ports,
  input: { id: string; received: bigint; ownerPercent: number }
): Promise<OverallStatus | "duplicate"> {
  if (!(await ports.claim(input.id))) {
    await ports.audit("duplicate_ignored", { id: input.id });
    return "duplicate";
  }
  const split = splitAmount(input.received, input.ownerPercent);
  const existing = await ports.getLegStatuses(input.id);
  const finals: LegStatus[] = [];

  for (const role of ROLES) {
    const debit = split[role];
    const prior = existing[role];
    // Never re-send a leg that is done or may still be in flight.
    if (prior === "completed" || prior === "skipped" || prior === "processing") {
      finals.push(prior);
      continue;
    }
    if (debit === 0n) {
      await ports.upsertLeg(input.id, role, { debit, status: "skipped", error: "Amount too small to split" });
      finals.push("skipped");
      continue;
    }
    // Record intent durably BEFORE any network call.
    await ports.upsertLeg(input.id, role, { debit, status: "processing" });
    let outcome: LegOutcome;
    try {
      outcome = await ports.sendLeg(role, debit);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      outcome =
        e instanceof NotSentError
          ? { status: "failed", error: msg }
          : // We cannot be sure whether it was sent. Do NOT mark failed and do NOT retry.
            { status: "processing", error: `Unconfirmed, check before retrying: ${msg}` };
    }
    await ports.upsertLeg(input.id, role, { debit, ...outcome });
    await ports.audit("leg_result", { id: input.id, role, status: outcome.status });
    finals.push(outcome.status);
  }

  const overall = aggregateStatus(finals);
  await ports.setIncomingStatus(input.id, overall);
  return overall;
}
