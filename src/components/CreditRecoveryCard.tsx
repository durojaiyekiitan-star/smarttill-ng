"use client";

import { useState } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";

interface Debtor {
  id: string;
  name: string;
  wallet: string;
  owed: number;
  installment: number;
  grantCap: string;
}

const INITIAL_DEBTORS: Debtor[] = [
  {
    id: "cred-1",
    name: "Chinedu Okafor (Regular Customer)",
    wallet: "$ilp.interledger-test.dev/chinedu",
    owed: 10.0,
    installment: 2.0,
    grantCap: "Capped Grant • Max 2.00/wk",
  },
  {
    id: "cred-2",
    name: "Mama Ngozi Food Canteen",
    wallet: "$ilp.interledger-test.dev/ngozi",
    owed: 15.0,
    installment: 5.0,
    grantCap: "Capped Grant • Max 5.00/wk",
  },
];

export default function CreditRecoveryCard({ code = "EUR" }: { code?: string }) {
  const [debtors, setDebtors] = useState<Debtor[]>(INITIAL_DEBTORS);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleCollect(d: Debtor) {
    setLoadingId(d.id);
    setNotice(null);
    try {
      const res = await fetch("/api/credit/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: d.name,
          walletPointer: d.wallet,
          amountUnits: d.installment,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Collection failed");

      setDebtors((prev) =>
        prev.map((item) =>
          item.id === d.id ? { ...item, owed: Math.max(0, Number((item.owed - d.installment).toFixed(2))) } : item
        )
      );

      setNotice(
        `Collected ${data.amount} ${code} from ${d.name} → Split ${data.reserveShare} (${data.reservePct}%) to Reserve & ${data.ownerShare} (${data.ownerPct}%) to Owner` +
          (data.whatsappSent ? " • WhatsApp alert sent!" : "")
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not collect installment");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <section className="mb-4 rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-xs">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Consent-Based Credit Recovery</h2>
          <p className="text-xs text-neutral-500">Pre-authorized customer Open Payments grants • Auto-splits on collection</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eef3ef] px-2.5 py-1 text-xs font-medium text-[#0f3d2e]">
          <ShieldCheck size={13} /> Recurring Grant
        </span>
      </div>

      {notice && (
        <div className="mb-3 rounded-xl border border-emerald-200 bg-[#f6faf7] p-3 text-xs font-medium text-[#0f3d2e]">
          {notice}
        </div>
      )}

      <div className="space-y-2.5">
        {debtors.map((d) => (
          <div
            key={d.id}
            className="flex flex-col justify-between gap-3 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3.5 sm:flex-row sm:items-center"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900">{d.name}</p>
              <p className="truncate font-mono text-xs text-neutral-500">{d.wallet}</p>
              <p className="mt-1 inline-block rounded-full bg-[#f5f1e4] px-2.5 py-0.5 text-[11px] font-medium text-[#7a6a35]">
                {d.grantCap} • Tab left: {d.owed.toFixed(2)} {code}
              </p>
            </div>

            <button
              onClick={() => handleCollect(d)}
              disabled={loadingId === d.id || d.owed <= 0}
              className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#0f3d2e] px-3.5 py-2 text-xs font-medium text-white transition hover:bg-[#0a2c21] active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={12} className={loadingId === d.id ? "animate-spin" : ""} />
              {loadingId === d.id
                ? "Settling…"
                : d.owed <= 0
                ? "Paid Off"
                : `Collect ${d.installment.toFixed(2)} ${code}`}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
