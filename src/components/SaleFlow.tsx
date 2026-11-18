import Link from "next/link";
import { ArrowDown, ArrowRight, Check, Clock, Minus, X } from "lucide-react";
import { formatMinor } from "@/lib/money";
import { StatusBadge } from "./ui";

interface Leg { role: string; status: string; debit_value: string }
interface Tx { id: string; reference: string; status: string; received_value: string; asset_code: string; asset_scale: number; reserve_percent: number; owner_percent: number }

function Icon({ status }: { status?: string }) {
  const cls = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full";
  if (status === "completed") return <span className={`${cls} bg-green-100 text-green-800`}><Check size={14} strokeWidth={3} /></span>;
  if (status === "failed") return <span className={`${cls} bg-red-100 text-red-700`}><X size={14} strokeWidth={3} /></span>;
  if (status === "skipped") return <span className={`${cls} bg-neutral-100 text-neutral-500`}><Minus size={14} /></span>;
  return <span className={`${cls} animate-pulse bg-amber-100 text-amber-700`}><Clock size={14} /></span>;
}

/** The whole idea in one picture: one sale in, two confirmed transfers out. */
export default function SaleFlow({ tx, legs }: { tx: Tx; legs: Leg[] }) {
  const amt = (v: string) => `${formatMinor(v, tx.asset_scale)} ${tx.asset_code}`;
  const rows = [
    { role: "reserve", label: "Business Reserve", pct: tx.reserve_percent },
    { role: "owner", label: "Owner Allocation", pct: tx.owner_percent },
  ];
  return (
    <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1.3fr]">
      <div className="rounded-xl bg-[#eef3ef] p-4">
        <p className="text-xs text-neutral-500">Sale received</p>
        <p className="mt-1 text-xl font-semibold tabular-nums">{amt(tx.received_value)}</p>
      </div>
      <ArrowRight className="hidden text-neutral-300 sm:block" />
      <ArrowDown className="mx-auto text-neutral-300 sm:hidden" />
      <div className="space-y-2">
        {rows.map((r) => {
          const l = legs.find((x) => x.role === r.role);
          return (
            <div key={r.role} className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 transition hover:border-[#0f3d2e]/40 hover:bg-[#f6faf7]">
              <div className="flex items-center gap-3">
                <Icon status={l?.status} />
                <div>
                  <p className="text-sm font-medium">{r.label} <span className="text-neutral-400">{r.pct}%</span></p>
                </div>
              </div>
              <span className="text-sm font-semibold tabular-nums">{l ? amt(l.debit_value) : "—"}</span>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between sm:col-span-3">
        <StatusBadge status={tx.status} />
        <Link href={`/transactions/${tx.id}`} className="text-sm font-medium text-[#0f3d2e] transition hover:translate-x-0.5 hover:underline">View receipt</Link>
      </div>
    </div>
  );
}
