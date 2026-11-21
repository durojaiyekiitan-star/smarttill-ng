import Link from "next/link";
import { ChevronRight, MessageCircle } from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";
import ApiButton from "@/components/ApiButton";
import AutoSync from "@/components/AutoSync";
import SaleFlow from "@/components/SaleFlow";
import CreditRecoveryCard from "@/components/CreditRecoveryCard";
import { Amount, Card, EmptyState, StatusBadge, lift, when } from "@/components/ui";
import { appMode, startOfLagosDayIso } from "@/lib/env";
import { formatMinor, illustrativeNgn, ngnPerUnit } from "@/lib/money";
import { whatsappConfigured } from "@/lib/notify";
import { hasActiveGrant } from "@/lib/openpayments/service";
import { getUser, supabaseServer } from "@/lib/supabase/server";

export default async function Dashboard() {
  const user = (await getUser())!;
  const sb = await supabaseServer();
  const mode = appMode();
  const [{ data: tx }, { data: legs }, { data: s }, { data: m }, { data: wcs }] = await Promise.all([
    sb.from("incoming_payments").select("*").eq("mode", mode).order("occurred_at", { ascending: false }).limit(1000),
    sb.from("outgoing_payments").select("role,status,debit_value,incoming_payment_id").eq("status", "completed"),
    sb.from("allocation_settings").select("*").maybeSingle(),
    sb.from("merchants").select("whatsapp_number,full_name").maybeSingle(),
    sb.from("wallet_configs").select("role"),
  ]);
  const rows = tx ?? [];
  const latest = rows[0];
  const { data: latestLegs } = latest
    ? await sb.from("outgoing_payments").select("role,status,debit_value").eq("incoming_payment_id", latest.id)
    : { data: [] };
  const ids = new Set(rows.map((r) => r.id));
  const code = latest?.asset_code ?? (mode === "demo" ? "DEMO" : "");
  const scale: number = latest?.asset_scale ?? 2;
  const sum = (xs: string[]) => xs.reduce((a, v) => a + BigInt(v), 0n);
  const total = sum(rows.map((r) => r.received_value));
  const reserve = sum((legs ?? []).filter((l) => l.role === "reserve" && ids.has(l.incoming_payment_id)).map((l) => l.debit_value));
  const owner = sum((legs ?? []).filter((l) => l.role === "owner" && ids.has(l.incoming_payment_id)).map((l) => l.debit_value));
  const dayStart = startOfLagosDayIso();
  const today = sum(rows.filter((r) => r.occurred_at >= dayStart).map((r) => r.received_value));
  const hasWallets = mode === "demo" ? true : (wcs?.length ?? 0) >= 3;
  const grantOk = mode === "demo" ? true : hasWallets && (await hasActiveGrant(user.id));
  const showNgn = mode !== "demo" && code;
  const first = (m?.full_name ?? "").trim().split(" ")[0];
  const waOn = Boolean(m?.whatsapp_number) && whatsappConfigured();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{first ? `Hi, ${first}` : "Dashboard"}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/settings#whatsapp" className="group inline-flex h-9 items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 text-sm text-neutral-600 transition hover:border-[#0f3d2e]/40 hover:bg-[#f6faf7] active:scale-95">
            <MessageCircle size={14} className={waOn ? "text-green-700" : "text-neutral-400"} />
            {waOn ? "WhatsApp alerts on" : m?.whatsapp_number ? "WhatsApp not connected" : "Turn on WhatsApp alerts"}
          </Link>
          {mode === "demo" ? <ApiButton label="Simulate a sale" busyLabel="Simulating…" url="/api/demo/sale" primary /> : <AutoSync />}
        </div>
      </div>

      {!hasWallets && (
        <Link href="/wallets" className="mb-4 block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 transition hover:bg-amber-100">
          <b>Connect your wallets</b> to start splitting sales.
        </Link>
      )}
      {hasWallets && !grantOk && (
        <Link href="/wallets" className="mb-4 block rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 transition hover:bg-amber-100">
          Sales are detected but not split yet. <b>Authorise transfers</b> to start.
        </Link>
      )}

      <section className="mb-4 rounded-2xl bg-[#0f3d2e] p-6 text-white shadow-[0_12px_32px_-16px_rgba(15,61,46,0.6)] md:p-8">
        <p className="text-sm text-white/70">Total received</p>
        <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums md:text-6xl">
          <AnimatedNumber value={total.toString()} scale={scale} /> <span className="text-xl font-medium text-white/50 md:text-2xl">{code}</span>
        </p>
        {showNgn && <p className="mt-2 text-xs text-white/50">≈ {illustrativeNgn(total, scale, ngnPerUnit())} (illustrative)</p>}
        <div className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
          <div><p className="text-xs text-white/60">Sales</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{rows.length}</p></div>
          <div><p className="text-xs text-white/60">Today</p><p className="mt-0.5 text-lg font-semibold tabular-nums">{formatMinor(today, scale)}</p></div>
        </div>
      </section>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <Card className={lift}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm text-neutral-500"><span className="h-2.5 w-2.5 rounded-full bg-[#0f3d2e]" />Business Reserve</p>
            <Link href="/allocation" className="rounded-full bg-[#eef3ef] px-2.5 py-0.5 text-xs font-medium text-[#0f3d2e] transition hover:bg-[#dfeae2]">{s?.reserve_percent ?? 70}%</Link>
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums"><AnimatedNumber value={reserve.toString()} scale={scale} /> <span className="text-base font-medium text-neutral-400">{code}</span></p>
        </Card>
        <Card className={lift}>
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm text-neutral-500"><span className="h-2.5 w-2.5 rounded-full bg-[#c4b07a]" />Owner Allocation</p>
            <Link href="/allocation" className="rounded-full bg-[#f5f1e4] px-2.5 py-0.5 text-xs font-medium text-[#7a6a35] transition hover:bg-[#ece5cf]">{s?.owner_percent ?? 30}%</Link>
          </div>
          <p className="mt-2 text-3xl font-semibold tabular-nums"><AnimatedNumber value={owner.toString()} scale={scale} /> <span className="text-base font-medium text-neutral-400">{code}</span></p>
        </Card>
      </div>
      <CreditRecoveryCard code={code || "EUR"} />

      {latest ? (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-medium text-neutral-500">Latest sale</h2>
          <SaleFlow tx={latest} legs={latestLegs ?? []} />
        </Card>
      ) : (
        <Card className="mb-4">
          <EmptyState title="No sales yet" body={mode === "demo" ? "Tap Simulate a sale." : "Send a test payment to your Main Till wallet."} />
        </Card>
      )}

      {rows.length > 1 && (
        <Card className="p-2">
          <ul>
            {rows.slice(1, 5).map((r) => (
              <li key={r.id}>
                <Link href={`/transactions/${r.id}`} className="group flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition hover:bg-[#f6faf7]">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{r.reference}</p>
                    <p className="text-xs text-neutral-500">{when(r.occurred_at)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <Amount value={r.received_value} scale={r.asset_scale} code={r.asset_code} className="text-sm font-medium" />
                    <span className="hidden sm:block"><StatusBadge status={r.status} /></span>
                    <ChevronRight size={16} className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="mt-4 text-center text-xs text-neutral-400">Revenue, not profit. Totals are confirmed transfers, not wallet balances.</p>
    </>
  );
}
