export const BUSINESS_TYPES = ["Provision shop", "Food vendor", "Market trader", "Other retail", "Services"];

export interface Profile {
  full_name?: string | null;
  phone?: string | null;
  business_name?: string | null;
  business_type?: string | null;
  location?: string | null;
}

/** Tier 1 is self-declared and NOT verified. Real ID checks (BVN/NIN) need a verification partner. */
export function kycChecklist(p: Profile) {
  const has = (v?: string | null) => Boolean(v && v.trim().length > 0);
  const items = [
    { key: "full_name", label: "Full name", done: has(p.full_name) },
    { key: "phone", label: "Phone number", done: has(p.phone) },
    { key: "business_name", label: "Shop name", done: has(p.business_name) },
    { key: "business_type", label: "Business type", done: has(p.business_type) },
    { key: "location", label: "Shop location", done: has(p.location) },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, done, total: items.length, tier1: done === items.length };
}
