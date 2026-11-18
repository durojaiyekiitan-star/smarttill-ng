import { describe, it, expect } from "vitest";
import { buildMessage, normalizePhone } from "./notify-format";

const tx = { reference: "ST-1A2B3C4D", mode: "testnet", status: "completed", received_value: "2500", asset_code: "USD", asset_scale: 2, reserve_percent: 70, owner_percent: 30 };

describe("normalizePhone", () => {
  it("handles Nigerian formats", () => {
    expect(normalizePhone("0801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("2348012345678")).toBe("+2348012345678");
    expect(normalizePhone("+234 801 234 5678")).toBe("+2348012345678");
    expect(normalizePhone("abc")).toBe(null);
    expect(normalizePhone("123")).toBe(null);
  });
});

describe("buildMessage", () => {
  it("shows a confirmed split", () => {
    const m = buildMessage(tx, [{ role: "reserve", status: "completed", debit_value: "1750" }, { role: "owner", status: "completed", debit_value: "750" }]);
    expect(m.includes("Sale: 25.00 USD")).toBe(true);
    expect(m.includes("Business Reserve (70%): 17.50 USD ✅")).toBe(true);
    expect(m.includes("Owner Allocation (30%): 7.50 USD ✅")).toBe(true);
  });
  it("never claims a failed leg was sent", () => {
    const m = buildMessage({ ...tx, status: "partial" }, [{ role: "reserve", status: "completed", debit_value: "1750" }, { role: "owner", status: "failed", debit_value: "750" }]);
    expect(m.includes("7.50 USD ❌ not sent")).toBe(true);
    expect(m.includes("split only partly done")).toBe(true);
  });
  it("labels demo messages", () => {
    expect(buildMessage({ ...tx, mode: "demo" }, []).startsWith("[DEMO]")).toBe(true);
  });
});
