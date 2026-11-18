"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Polls the server for new payments while the dashboard is open. The server does the real work. */
export default function AutoSync() {
  const router = useRouter();
  const running = useRef(false);
  const [spin, setSpin] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [last, setLast] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSpin(true);
    try {
      await supabaseBrowser().auth.getSession();
      const res = await fetch("/api/sync", { method: "POST" });
      const d = await res.json();
      setLast(new Date().toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" }));
      setErr(d.error ?? null);
      if (d.processed > 0) setToast("New sale received and split");
      else if (d.ingested > 0) setToast("New sale detected");
      if (d.ingested || d.processed || d.reconciled) router.refresh();
    } catch {
      setErr("Could not reach the server");
    } finally {
      running.current = false;
      setSpin(false);
    }
  }, [router]);

  useEffect(() => {
    run();
    const t = setInterval(run, 20000);
    return () => clearInterval(t);
  }, [run]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <>
      <button
        onClick={run}
        title={err ? err : last ? `Last checked ${last}. Click to check now.` : "Checking for new payments"}
        className="group inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50 active:scale-95"
      >
        <span className={`h-2 w-2 rounded-full ${err ? "bg-red-500" : "animate-pulse bg-green-600"}`} />
        {err ? "Check failed" : "Live"}
        <RefreshCw size={14} className={`text-neutral-400 transition group-hover:text-neutral-700 ${spin ? "animate-spin" : ""}`} />
      </button>
      {err && <p className="basis-full text-xs text-red-700">{err}</p>}
      {toast && (
        <div role="status" className="fixed bottom-24 right-4 z-30 flex items-center gap-3 rounded-2xl bg-[#0f3d2e] px-4 py-3 text-sm font-medium text-white shadow-lg md:bottom-6">
          <span className="h-2 w-2 rounded-full bg-[#7fd1a6]" />
          {toast}
          <button onClick={() => setToast(null)} aria-label="Dismiss" className="text-white/60 hover:text-white">×</button>
        </div>
      )}
    </>
  );
}
