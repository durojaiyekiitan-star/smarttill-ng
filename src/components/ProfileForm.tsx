"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { BUSINESS_TYPES } from "@/lib/kyc";
import { btnPrimary } from "./ui";

interface P { full_name: string; phone: string; business_name: string; business_type: string; location: string }

const input = "mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 transition focus:border-[#0f3d2e] focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/20";

export default function ProfileForm({ initial }: { initial: P }) {
  const router = useRouter();
  const [p, setP] = useState<P>(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = (k: keyof P) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setP({ ...p, [k]: e.target.value }); setMsg(null); };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(p) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: d.error ?? "Could not save" });
      else {
        if (d.phone) setP((x) => ({ ...x, phone: d.phone }));
        setMsg({ ok: true, text: "Saved" });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Full name<input value={p.full_name} onChange={set("full_name")} autoComplete="name" className={input} /></label>
      <label className="text-sm font-medium">Phone number<input value={p.phone} onChange={set("phone")} type="tel" placeholder="0801 234 5678" autoComplete="tel" className={input} /></label>
      <label className="text-sm font-medium">Shop name<input value={p.business_name} onChange={set("business_name")} className={input} /></label>
      <label className="text-sm font-medium">Business type
        <select value={p.business_type} onChange={set("business_type")} className={input}>
          <option value="">Choose…</option>
          {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      <label className="text-sm font-medium sm:col-span-2">Shop location<input value={p.location} onChange={set("location")} placeholder="Market or area, city, state" className={input} /></label>
      <div className="flex items-center gap-4 sm:col-span-2">
        <button disabled={busy} className={btnPrimary}>{busy ? "Saving…" : "Save profile"}</button>
        {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
      </div>
    </form>
  );
}
