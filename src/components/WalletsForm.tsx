"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary } from "./ui";

interface W { main: string; reserve: string; owner: string }
const FIELDS: { key: keyof W; label: string; hint: string }[] = [
  { key: "main", label: "Main Till", hint: "Where your customers pay you" },
  { key: "reserve", label: "Business Reserve", hint: "Where your restock money goes" },
  { key: "owner", label: "Owner Allocation", hint: "Where your own share goes" },
];
const input = "mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 text-sm transition focus:border-[#0f3d2e] focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/20";

export default function WalletsForm({ initial }: { initial: W }) {
  const router = useRouter();
  const [w, setW] = useState<W>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const changingMain = initial.main && initial.main.trim().toLowerCase() !== w.main.trim().toLowerCase();
    if (changingMain && !window.confirm("Changing your Main Till wallet removes your current authorisation. You will need to authorise again. Continue?")) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/wallets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(w) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: d.error ?? "Could not save your wallets" });
      else {
        setMsg({ ok: true, text: d.mainChanged ? "Wallets connected. Now authorise transfers." : "Saved." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      {FIELDS.map((f) => (
        <label key={f.key} className="block text-sm font-medium">
          {f.label} <span className="font-normal text-neutral-400">· {f.hint}</span>
          <input value={w[f.key]} onChange={(e) => { setW({ ...w, [f.key]: e.target.value }); setMsg(null); }}
            placeholder="https://ilp.interledger-test.dev/your-name" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={input} />
        </label>
      ))}
      <p className="text-xs text-neutral-500">Use your own test wallet addresses. Tip: three separate accounts let you watch each balance change on its own.</p>
      <div className="flex flex-wrap items-center gap-4">
        <button disabled={busy} className={btnPrimary}>{busy ? "Checking wallets…" : initial.main ? "Save wallets" : "Connect wallets"}</button>
        {msg && <p role={msg.ok ? "status" : "alert"} className={`text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
