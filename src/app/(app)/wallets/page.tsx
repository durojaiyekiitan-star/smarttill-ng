import { CheckCircle2, CircleAlert } from "lucide-react";
import ApiButton from "@/components/ApiButton";
import GrantButton from "@/components/GrantButton";
import { Card, PageTitle, lift } from "@/components/ui";
import { appMode } from "@/lib/env";
import { formatMinor } from "@/lib/money";
import { getWallet } from "@/lib/openpayments/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUser, supabaseServer } from "@/lib/supabase/server";

const ROLES = [
  { role: "main", name: "Main Till", note: "Receives sales", dot: "bg-neutral-800" },
  { role: "reserve", name: "Business Reserve", note: "Gets the business share", dot: "bg-[#0f3d2e]" },
  { role: "owner", name: "Owner Allocation", note: "Gets your share", dot: "bg-[#c4b07a]" },
];

export default async function WalletsPage({ searchParams }: { searchParams: Promise<{ grant?: string; msg?: string }> }) {
  const sp = await searchParams;
  const user = (await getUser())!;
  const sb = await supabaseServer();
  const mode = appMode();
  const { data: wcs } = await sb.from("wallet_configs").select("role,wallet_url");
  const { data: g } = await supabaseAdmin().from("grants").select("token_enc,limit_value,asset_code,asset_scale").eq("merchant_id", user.id).maybeSingle();
  const authorised = Boolean(g?.token_enc);

  const details = await Promise.all(
    ROLES.map(async (r) => {
      const url = wcs?.find((w) => w.role === r.role)?.wallet_url;
      if (!url) return { ...r, url, asset: "", error: "Not configured" };
      if (mode === "demo") return { ...r, url, asset: "", error: undefined };
      try {
        const w = await getWallet(url);
        return { ...r, url, asset: `${w.assetCode} · scale ${w.assetScale}`, error: undefined };
      } catch {
        return { ...r, url, asset: "", error: "Could not reach this wallet" };
      }
    })
  );

  return (
    <>
      <PageTitle title="Wallets" />
      {sp.grant === "ok" && <p role="status" className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">Authorised. Transfers are on.</p>}
      {sp.grant === "error" && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{sp.msg ?? "Authorisation failed."}</p>}

      <div className="grid gap-4 md:grid-cols-3">
        {details.map((d) => (
          <Card key={d.role} className={lift}>
            <p className="flex items-center gap-2 font-medium"><span className={`h-2.5 w-2.5 rounded-full ${d.dot}`} />{d.name}</p>
            <p className="mt-1 text-sm text-neutral-500">{d.note}</p>
            <p className="mt-3 truncate text-xs text-neutral-700" title={d.url}>{d.url?.replace("https://", "") ?? "—"}</p>
            {d.asset && <p className="mt-1 text-xs text-neutral-400">{d.asset}</p>}
            {d.error && <p role="alert" className="mt-1 text-xs text-red-700">{d.error}</p>}
          </Card>
        ))}
      </div>

      {mode === "testnet" && (
        <Card className="mt-4">
          <div className="flex items-start gap-3">
            {authorised ? <CheckCircle2 className="mt-0.5 text-green-700" size={20} /> : <CircleAlert className="mt-0.5 text-amber-600" size={20} />}
            <div>
              <p className="font-medium">{authorised ? "Transfers are authorised" : "Transfers are not authorised yet"}</p>
              <p className="mt-0.5 text-sm text-neutral-500">
                {authorised && g?.limit_value ? `Up to ${formatMinor(g.limit_value, g.asset_scale)} ${g.asset_code} in total. You approve once at your wallet.` : "Approve once at your wallet to let SmartTill split sales."}
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <GrantButton label={authorised ? "Re-authorise" : "Authorise transfers"} />
            <ApiButton label="Check for payments" busyLabel="Checking…" url="/api/sync" />
          </div>
        </Card>
      )}
    </>
  );
}
