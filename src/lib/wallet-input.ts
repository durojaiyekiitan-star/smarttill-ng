export type WalletRole = "main" | "reserve" | "owner";
export type WalletInputs = Record<WalletRole, string>;

const LABEL: Record<WalletRole, string> = { main: "Main Till", reserve: "Business Reserve", owner: "Owner Allocation" };

/** Accepts https://… or the $ payment-pointer form. Returns a clean https URL without a trailing slash. */
export function normalizeWalletUrl(u: string): string {
  return u.trim().replace(/^\$/, "https://").replace(/\/+$/, "");
}

export type WalletValidation = { ok: true; urls: WalletInputs } | { ok: false; error: string };

export function validateWalletInputs(input: Partial<Record<WalletRole, unknown>>): WalletValidation {
  const urls = {} as WalletInputs;
  for (const role of ["main", "reserve", "owner"] as const) {
    const raw = input[role];
    if (typeof raw !== "string" || raw.trim() === "") return { ok: false, error: `Enter the ${LABEL[role]} wallet address.` };
    const n = normalizeWalletUrl(raw);
    let url: URL;
    try {
      url = new URL(n);
    } catch {
      return { ok: false, error: `${LABEL[role]}: that is not a valid wallet address. It looks like https://ilp.interledger-test.dev/yourname` };
    }
    if (url.protocol !== "https:") return { ok: false, error: `${LABEL[role]}: the address must start with https://` };
    if (url.pathname === "/" || url.pathname === "") return { ok: false, error: `${LABEL[role]}: include your wallet name at the end of the address.` };
    urls[role] = n;
  }
  const lower = Object.values(urls).map((u) => u.toLowerCase());
  if (new Set(lower).size !== 3) return { ok: false, error: "Main Till, Business Reserve and Owner Allocation must be three different wallet addresses." };
  return { ok: true, urls };
}
