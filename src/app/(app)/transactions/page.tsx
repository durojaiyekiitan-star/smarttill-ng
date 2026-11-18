import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Amount, Card, EmptyState, PageTitle, StatusBadge, when } from "@/components/ui";
import { appMode } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";

export default async function Transactions({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const attention = filter === "attention";
  const sb = await supabaseServer();
  let q = sb.from("incoming_payments").select("*").eq("mode", appMode()).order("occurred_at", { ascending: false }).limit(200);
  if (attention) q = q.in("status", ["partial", "failed", "processing"]);
  const { data } = await q;
  const rows = data ?? [];
  const tab = (on: boolean) => `rounded-full px-4 py-1.5 text-sm font-medium transition active:scale-95 ${on ? "bg-[#0f3d2e] text-white shadow-sm" : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-[#eef3ef]"}`;

  return (
    <>
      <PageTitle title="Transactions" />
      <div className="mb-4 flex gap-2">
        <Link href="/transactions" className={tab(!attention)}>All</Link>
        <Link href="/transactions?filter=attention" className={tab(attention)}>Needs attention</Link>
      </div>
      {rows.length === 0 ? (
        <Card><EmptyState title={attention ? "All clear" : "No transactions yet"} body={attention ? "Nothing needs attention." : "Sales appear here automatically."} /></Card>
      ) : (
        <>
          <Card className="hidden overflow-hidden p-0 md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-neutral-200 text-neutral-500">
                <tr><th className="px-5 py-3 font-medium">Reference</th><th className="px-3 py-3 font-medium">Date</th><th className="px-3 py-3 text-right font-medium">Amount</th><th className="px-3 py-3 font-medium">Status</th><th className="w-8" /></tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {rows.map((r) => (
                  <tr key={r.id} className="group transition hover:bg-[#f6faf7]">
                    <td className="px-5 py-3"><Link href={`/transactions/${r.id}`} className="font-medium text-[#0f3d2e] hover:underline">{r.reference}</Link></td>
                    <td className="px-3 py-3 text-neutral-600">{when(r.occurred_at)}</td>
                    <td className="px-3 py-3 text-right"><Amount value={r.received_value} scale={r.asset_scale} code={r.asset_code} /></td>
                    <td className="px-3 py-3"><StatusBadge status={r.status} /></td>
                    <td className="pr-4"><ChevronRight size={16} className="text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <ul className="space-y-3 md:hidden">
            {rows.map((r) => (
              <li key={r.id}>
                <Link href={`/transactions/${r.id}`} className="block rounded-2xl border border-neutral-200 bg-white p-4 transition active:scale-[0.98]">
                  <div className="flex items-start justify-between gap-2"><span className="font-medium">{r.reference}</span><StatusBadge status={r.status} /></div>
                  <Amount value={r.received_value} scale={r.asset_scale} code={r.asset_code} className="mt-2 block text-lg font-semibold" />
                  <p className="mt-1 text-xs text-neutral-500">{when(r.occurred_at)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
