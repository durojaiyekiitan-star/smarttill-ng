import { describe, it, expect } from "vitest";
import { normalizeWalletUrl, validateWalletInputs } from "./wallet-input";

const ok = { main: "https://ilp.interledger-test.dev/till", reserve: "https://ilp.interledger-test.dev/reserve", owner: "https://ilp.interledger-test.dev/owner" };

describe("normalizeWalletUrl", () => {
  it("handles $ pointers, spaces and trailing slashes", () => {
    expect(normalizeWalletUrl("  $ilp.interledger-test.dev/till/ ")).toBe("https://ilp.interledger-test.dev/till");
  });
});

describe("validateWalletInputs", () => {
  it("accepts three different valid addresses", () => {
    expect(validateWalletInputs(ok).ok).toBe(true);
  });
  it("accepts the $ form", () => {
    const r = validateWalletInputs({ ...ok, main: "$ilp.interledger-test.dev/till" });
    expect(r.ok && r.urls.main).toBe("https://ilp.interledger-test.dev/till");
  });
  it("rejects missing, malformed, non-https and name-less addresses", () => {
    expect(validateWalletInputs({ ...ok, owner: "" }).ok).toBe(false);
    expect(validateWalletInputs({ ...ok, owner: "not a url" }).ok).toBe(false);
    expect(validateWalletInputs({ ...ok, owner: "http://ilp.interledger-test.dev/owner" }).ok).toBe(false);
    expect(validateWalletInputs({ ...ok, owner: "https://ilp.interledger-test.dev/" }).ok).toBe(false);
  });
  it("rejects the same wallet used twice, ignoring case and trailing slash", () => {
    expect(validateWalletInputs({ ...ok, reserve: "https://ILP.interledger-test.dev/till/" }).ok).toBe(false);
  });
});
