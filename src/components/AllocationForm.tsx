"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { splitAmount, validatePercentages } from "@/lib/allocation";
import { formatMinor } from "@/lib/money";
import { btnPrimary } from "./ui";

const PRESETS = [[80, 20], [70, 30], [60, 40], [50, 50]];

export default function AllocationForm({ initialReserve }: { initialReserve: number }) {
  const router = useRouter();
  const [reserve, setReserve] = useState(initialReserve);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owner = 100 - reserve;
  const check = validatePercentages(reserve, owner);
  const sample = splitAmount(10000n, owner);
  const change = (n: number) => { setReserve(n); setMsg(null); };

  async function save() {
    if (!check.ok) return;
    if (!window.confirm(`Save ${reserve}% Business Reserve and ${owner}% Owner Allocation? It applies to new sales only.`)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/allocation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reserve_percent: reserve, owner_percent: owner }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) setMsg({ ok: false, text: d.error ?? "Could not save" });
    else {
      setMsg({ ok: true, text: "Saved" });
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([r, o]) => (
          <button key={r} onClick={() => change(r)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition active:scale-95 ${reserve === r ? "bg-[#0f3d2e] text-white shadow-sm" : "bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-[#eef3ef] hover:ring-[#0f3d2e]/30"}`}>
            {r} / {o}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl bg-[#0f3d2e] p-5 text-white">
          <p className="text-sm text-white/70">Business Reserve</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{reserve}%</p>
        </div>
        <div className="rounded-2xl bg-[#eef3ef] p-5">
          <p className="text-sm text-neutral-500">Owner Allocation</p>
          <p className="mt-1 text-4xl font-semibold tabular-nums">{owner}%</p>
        </div>
      </div>

      <input type="range" min={1} max={99} value={Math.min(99, Math.max(1, reserve))} onChange={(e) => change(Number(e.target.value))}
        aria-label="Business Reserve percentage" className="h-2 w-full cursor-pointer accent-[#0f3d2e]" />

      {check.ok ? (
        <p className="text-sm text-neutral-600">
          A 100.00 sale sends <b>{formatMinor(sample.reserve / 100n, 0)}.00</b> to your Reserve and <b>{formatMinor(sample.owner / 100n, 0)}.00</b> to you.
        </p>
      ) : (
        <p role="alert" className="text-sm text-red-700">{check.error}</p>
      )}

      <div className="flex items-center gap-4">
        <button onClick={save} disabled={busy || !check.ok} className={btnPrimary}>{busy ? "Saving…" : "Save allocation"}</button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
