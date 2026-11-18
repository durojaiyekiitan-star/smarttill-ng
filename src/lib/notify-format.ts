import { formatMinor } from "./money";

/** Accepts 0801 234 5678, 2348012345678 or +2348012345678. Returns +E.164 or null. */
export function normalizePhone(input: string): string | null {
  let s = input.replace(/[\s\-()]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (/^0\d{10}$/.test(s)) s = "+234" + s.slice(1);
  else if (/^234\d{10}$/.test(s)) s = "+" + s;
  return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
}

export interface TxForMessage {
  reference: string;
  mode: string;
  status: string;
  received_value: string;
  asset_code: string;
  asset_scale: number;
  reserve_percent: number;
  owner_percent: number;
}
export interface LegForMessage { role: string; status: string; debit_value: string }

export function buildMessage(tx: TxForMessage, legs: LegForMessage[]): string {
  const amt = (v: string) => `${formatMinor(v, tx.asset_scale)} ${tx.asset_code}`;
  const head =
    tx.status === "completed" ? "✅ Sale received and split"
    : tx.status === "partial" ? "⚠️ Sale received, split only partly done"
    : "❌ Sale received, split failed";
  const line = (role: "reserve" | "owner") => {
    const l = legs.find((x) => x.role === role);
    const label = role === "reserve" ? `Business Reserve (${tx.reserve_percent}%)` : `Owner Allocation (${tx.owner_percent}%)`;
    if (!l) return `${label}: not sent`;
    if (l.status === "completed") return `${label}: ${amt(l.debit_value)} ✅`;
    if (l.status === "skipped") return `${label}: nothing to send`;
    if (l.status === "failed") return `${label}: ${amt(l.debit_value)} ❌ not sent`;
    return `${label}: ${amt(l.debit_value)} ⏳ in progress`;
  };
  return [
    `${tx.mode === "demo" ? "[DEMO] " : ""}SmartTill NG`,
    head,
    "",
    `Sale: ${amt(tx.received_value)}`,
    line("reserve"),
    line("owner"),
    "",
    `Ref ${tx.reference}`,
  ].join("\n");
}
