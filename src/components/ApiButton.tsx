"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { btnPrimary, btnSecondary } from "./ui";

/** POSTs to one of our API routes, shows the real result, then refreshes the page data. */
export default function ApiButton({ label, busyLabel, url, body, confirmText, primary = false }: {
  label: string; busyLabel: string; url: string; body?: unknown; confirmText?: string; primary?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) setNote({ ok: false, text: data.error ?? "Something went wrong" });
      else if (data.needsWallets) setNote({ ok: false, text: "Connect your wallets on the Wallets page first." });
      else if (data.needsGrant) setNote({ ok: false, text: "Authorise outgoing payments on the Wallets page first." });
      else if (data.busy) setNote({ ok: false, text: "Another check is already running. Try again in a moment." });
      else setNote({ ok: true, text: "Done" });
      router.refresh();
    } catch {
      setNote({ ok: false, text: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button onClick={run} disabled={busy} className={primary ? btnPrimary : btnSecondary}>{busy ? busyLabel : label}</button>
      {note && <p role="status" className={`text-sm ${note.ok ? "text-green-800" : "text-red-700"}`}>{note.text}</p>}
    </div>
  );
}
