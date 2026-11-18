import { describe, it, expect } from "vitest";
import { allocateIncoming, NotSentError, type LegOutcome, type Ports } from "./processor";
import type { LegStatus, OverallStatus, Role } from "./allocation";

function fakePorts(send: (role: Role, debit: bigint) => Promise<LegOutcome>, startStatus = "pending") {
  const state = { status: startStatus as string, legs: {} as Partial<Record<Role, LegStatus>>, sent: [] as string[], final: "" as OverallStatus | "" };
  const ports: Ports = {
    async claim() {
      if (state.status !== "pending") return false;
      state.status = "processing";
      return true;
    },
    async getLegStatuses() { return { ...state.legs }; },
    async upsertLeg(_id, role, d) { state.legs[role] = (d.status ?? "processing") as LegStatus; },
    async sendLeg(role, debit) { state.sent.push(`${role}:${debit}`); return send(role, debit); },
    async setIncomingStatus(_id, s) { state.final = s; },
    async audit() {},
  };
  return { ports, state };
}
const ok = async (): Promise<LegOutcome> => ({ status: "completed", opUrl: "https://x/op" });
const input = { id: "in1", received: 10000n, ownerPercent: 30 };

describe("allocateIncoming", () => {
  it("both legs succeed with the right amounts", async () => {
    const { ports, state } = fakePorts(ok);
    expect(await allocateIncoming(ports, input)).toBe("completed");
    expect(state.sent).toEqual(["reserve:7000", "owner:3000"]);
  });

  it("duplicate processing of the same incoming payment sends nothing the second time", async () => {
    const { ports, state } = fakePorts(ok);
    await allocateIncoming(ports, input);
    const again = await allocateIncoming(ports, input);
    expect(again).toBe("duplicate");
    expect(state.sent.length).toBe(2);
  });

  it("concurrent duplicate runs only process once", async () => {
    const { ports, state } = fakePorts(ok);
    const [a, b] = await Promise.all([allocateIncoming(ports, input), allocateIncoming(ports, input)]);
    expect([a, b].sort()).toEqual(["completed", "duplicate"]);
    expect(state.sent.length).toBe(2);
  });

  it("one leg succeeds, one confirmed not sent -> partial", async () => {
    const { ports, state } = fakePorts(async (role) => {
      if (role === "owner") throw new NotSentError("quote rejected");
      return ok();
    });
    expect(await allocateIncoming(ports, input)).toBe("partial");
    expect(state.legs).toEqual({ reserve: "completed", owner: "failed" });
  });

  it("both legs fail -> failed", async () => {
    const { ports } = fakePorts(async () => { throw new NotSentError("grant expired"); });
    expect(await allocateIncoming(ports, input)).toBe("failed");
  });

  it("an unexpected error is NOT marked failed (it may have been sent) and is not retried", async () => {
    const { ports, state } = fakePorts(async (role) => {
      if (role === "reserve") throw new Error("socket hang up");
      return ok();
    });
    const res = await allocateIncoming(ports, input);
    expect(state.legs.reserve).toBe("processing");
    expect(res).toBe("processing");
    expect(state.sent.filter((s) => s.startsWith("reserve")).length).toBe(1);
  });

  it("a leg still processing after verification stays processing", async () => {
    const { ports } = fakePorts(async () => ({ status: "processing" }));
    expect(await allocateIncoming(ports, input)).toBe("processing");
  });

  it("zero-value share is skipped, not sent", async () => {
    const { ports, state } = fakePorts(ok);
    const res = await allocateIncoming(ports, { id: "in2", received: 1n, ownerPercent: 30 });
    expect(res).toBe("completed");
    expect(state.sent).toEqual(["reserve:1"]);
  });

  it("retry only re-sends the failed leg", async () => {
    const { ports, state } = fakePorts(ok);
    state.legs = { reserve: "completed", owner: "failed" };
    state.status = "pending"; // reset by the retry action
    expect(await allocateIncoming(ports, input)).toBe("completed");
    expect(state.sent).toEqual(["owner:3000"]);
  });
});
