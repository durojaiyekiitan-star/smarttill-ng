import { describe, it, expect } from "vitest";
import { kycChecklist } from "./kyc";

const full = { full_name: "Kiitan D", phone: "+2348012345678", business_name: "Kiitan Provisions", business_type: "Provision shop", location: "Ota, Ogun" };

describe("kycChecklist", () => {
  it("is tier 1 only when every field is filled", () => {
    const k = kycChecklist(full);
    expect(k.tier1).toBe(true);
    expect(k.done).toBe(5);
  });
  it("counts missing and blank fields", () => {
    const k = kycChecklist({ ...full, phone: null, location: "   " });
    expect(k.tier1).toBe(false);
    expect(k.done).toBe(3);
  });
});
