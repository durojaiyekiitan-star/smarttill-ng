"use client";
import { useState } from "react";
import { btnPrimary } from "./ui";

export default function GrantButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function start() {
    if (!window.confirm("You will be sent to your wallet provider to approve SmartTill sending your allocations from Main Till, up to the limit shown. Continue?")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/grant/start", { method: "POST" });
      const d = await res.json();
      if (!res.ok || !d.redirect) throw new Error(d.error ?? "Could not start authorisation");
      window.location.href = d.redirect;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not start authorisation");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button onClick={start} disabled={busy} className={btnPrimary}>{busy ? "Opening wallet…" : label}</button>
      {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
    </div>
  );
}
