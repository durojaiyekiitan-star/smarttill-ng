"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary } from "./ui";

export default function WhatsAppForm({ initial, configured }: { initial: string; configured: boolean }) {
  const router = useRouter();
  const [number, setNumber] = useState(initial);
  const [busy, setBusy] = useState<"save" | "test" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function call(kind: "save" | "test") {
    setBusy(kind);
    setMsg(null);
    try {
      const res = await fetch("/api/whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(kind === "save" ? { number } : { number, test: true }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: d.error ?? "Something went wrong" });
      else {
        if (d.number) setNumber(d.number);
        setMsg({ ok: true, text: kind === "save" ? (d.number ? "Saved" : "Alerts turned off") : "Test sent. Check WhatsApp." });
        router.refresh();
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach the server" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {!configured && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">WhatsApp is not connected on the server yet. You can save your number now. Alerts start once it is connected.</p>}
      <input type="tel" inputMode="tel" placeholder="0801 234 5678" value={number} onChange={(e) => { setNumber(e.target.value); setMsg(null); }}
        className="h-11 w-full rounded-xl border border-neutral-300 px-3 transition focus:border-[#0f3d2e] focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/20" />
      <div className="flex flex-wrap items-center gap-3">
        <button onClick={() => call("save")} disabled={busy !== null} className={btnPrimary}>{busy === "save" ? "Saving…" : "Save number"}</button>
        <button onClick={() => call("test")} disabled={busy !== null || number.trim() === "" || !configured} className={btnSecondary}>{busy === "test" ? "Sending…" : "Send test alert"}</button>
      </div>
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
