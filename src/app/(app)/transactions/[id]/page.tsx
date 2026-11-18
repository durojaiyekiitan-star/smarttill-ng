import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, Minus, X } from "lucide-react";
import ApiButton from "@/components/ApiButton";
import { PrintButton } from "@/components/SmallButtons";
import { Amount, Card, ModeBadge, StatusBadge, when } from "@/components/ui";
import { splitAmount } from "@/lib/allocation";
import { supabaseServer } from "@/lib/supabase/server";

const LABEL: Record<string, string> = { reserve: "Business Reserve", owner: "Owner Allocation" };
const NOTE: Record<string, string> = { completed: "Transferred", processing: "In progress", pending: "Not sent yet", failed: "Not sent", skipped: "Nothing to send" };

function Dot({ status }: { status: string }) {
  const cls = "flex h-6 w-6 shrink-0 items-center justify-center rounded-full";
  if (status === "completed") return <span className={`${cls} bg-green-100 text-green-800`}><Check size={14} strokeWidth={3} /></span>;
  if (status === "failed") return <span className={`${cls} bg-red-100 text-red-700`}><X size={14} strokeWidth={3} /></span>;
  if (status === "skipped") return <span className={`${cls} bg-neutral-100 text-neutral-500`}><Minus size={14} /></span>;
  return <span className={`${cls} animate-pulse bg-amber-100 text-amber-700`}><Clock size={14} /></span>;
}

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sb = await supabaseServer();
  const { data: tx } = await sb.from("incoming_payments").select("*").eq("id", id).maybeSingle();
  if (!tx) notFound();
  const { data: legData } = await sb.from("outgoing_payments").select("*").eq("incoming_payment_id", id);
  const legs = legData ?? [];
  const expected = splitAmount(BigInt(tx.received_value), tx.owner_percent);
  const demo = tx.mode === "demo";

  return (
    <div className="mx-auto max-w-md">
      <Link href="/transactions" className="group mb-4 inline-flex items-center gap-1.5 text-sm text-neutral-500 transition hover:text-neutral-900 print:hidden">
        <ArrowLeft size={14} className="transition group-hover:-translate-x-0.5" /> Transactions
      </Link>

      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[#0f3d2e]">SmartTill receipt</p>
            <p className="mt-0.5 text-xs text-neutral-500">{tx.reference} · {when(tx.occurred_at)}</p>
          </div>
          <div className="flex items-center gap-2"><ModeBadge mode={tx.mode} /><StatusBadge status={tx.status} /></div>
        </div>
        {demo && <p className="mt-3 rounded-lg bg-neutral-900 px-3 py-2 text-xs text-white">Simulated. No real transfer took place.</p>}

        <p className="mt-6 text-sm text-neutral-500">Payment received</p>
        <Amount value={tx.received_value} scale={tx.asset_scale} code={tx.asset_code} className="text-4xl font-semibold tracking-tight" />

        <ul className="mt-6 space-y-2">
          {(["reserve", "owner"] as const).map((role) => {
            const l = legs.find((x) => x.role === role);
            const st = l?.status ?? "pending";
            return (
              <li key={role} className="flex items-center justify-between gap-3 rounded-xl bg-neutral-50 px-3 py-3">
                <div className="flex items-center gap-3">
                  <Dot status={st} />
                  <div>
                    <p className="text-sm font-medium">{LABEL[role]} <span className="text-neutral-400">{role === "reserve" ? tx.reserve_percent : tx.owner_percent}%</span></p>
                    <p className="text-xs text-neutral-500">{NOTE[st]}</p>
                  </div>
                </div>
                <Amount value={l?.debit_value ?? expected[role].toString()} scale={tx.asset_scale} code={tx.asset_code} className="text-sm font-semibold" />
              </li>
            );
          })}
        </ul>
        <div className="mt-6"><PrintButton /></div>
      </Card>

      {!demo && (tx.status === "partial" || tx.status === "failed") && (
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 print:hidden">
          <p className="mb-3 text-sm text-orange-900">Some transfers did not go through. Completed ones will not be sent again.</p>
          <ApiButton label="Retry failed transfers" busyLabel="Retrying…" url="/api/retry" body={{ incomingId: tx.id }} confirmText="Retry only the failed transfers?" primary />
        </div>
      )}
      {!demo && tx.status === "processing" && (
        <div className="mt-4 print:hidden"><ApiButton label="Refresh status" busyLabel="Checking…" url="/api/sync" /></div>
      )}

      <details className="group mt-4 rounded-2xl border border-neutral-200 bg-white p-4 print:hidden">
        <summary className="cursor-pointer list-none text-sm font-medium text-neutral-600 transition hover:text-neutral-900">Technical details</summary>
        <dl className="mt-3 space-y-3 break-all text-xs text-neutral-500">
          <div><dt className="font-medium text-neutral-700">Asset</dt><dd>{tx.asset_code}, scale {tx.asset_scale}</dd></div>
          <div><dt className="font-medium text-neutral-700">Incoming payment</dt><dd>{tx.op_url}</dd></div>
          {legs.map((l) => (
            <div key={l.id}>
              <dt className="font-medium text-neutral-700">{LABEL[l.role]}</dt>
              <dd>{l.quote_id && <>Quote: {l.quote_id}<br /></>}{l.op_url ? <>Outgoing payment: {l.op_url}</> : "No outgoing payment"}{l.error && <><br />{l.error}</>}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
