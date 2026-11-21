import { NextRequest, NextResponse } from "next/server";
import { describeError } from "@/lib/errors";
import { getWallet } from "@/lib/openpayments/client";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { validateWalletInputs, type WalletRole } from "@/lib/wallet-input";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

const LABEL: Record<WalletRole, string> = { main: "Main Till", reserve: "Business Reserve", owner: "Owner Allocation" };

/** Saves the merchant's OWN wallet addresses after checking each one is a real Open Payments wallet. */
export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const v = validateWalletInputs(await req.json().catch(() => ({})));
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  // 1. Every address must resolve to a real wallet, so typos are caught now, not mid-payment.
  const assets = {} as Record<WalletRole, { code: string; scale: number }>;
  for (const role of ["main", "reserve", "owner"] as const) {
    try {
      const w = await getWallet(v.urls[role]);
      assets[role] = { code: w.assetCode, scale: w.assetScale };
    } catch (e) {
      return NextResponse.json({ error: `${LABEL[role]}: no Open Payments wallet was found at that address. Check it and try again. (${describeError(e)})` }, { status: 400 });
    }
  }

  const admin = supabaseAdmin();

  // 2. One Main Till wallet can belong to only one SmartTill account, so two accounts can never split the same sales.
  const { data: taken } = await admin.from("wallet_configs").select("merchant_id").eq("role", "main").eq("wallet_url", v.urls.main).neq("merchant_id", user.id).limit(1);
  if (taken?.length) return NextResponse.json({ error: "That Main Till wallet is already connected to another SmartTill account." }, { status: 409 });

  // 3. Changing Main Till: finish open sales first, then drop the old authorisation (it was for the old wallet).
  const { data: current } = await admin.from("wallet_configs").select("role,wallet_url").eq("merchant_id", user.id);
  const oldMain = current?.find((w) => w.role === "main")?.wallet_url;
  const mainChanged = !oldMain || oldMain.toLowerCase() !== v.urls.main.toLowerCase();
  if (oldMain && mainChanged) {
    const { count } = await admin.from("incoming_payments").select("id", { count: "exact", head: true }).eq("merchant_id", user.id).in("status", ["pending", "processing"]);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "Some sales are still being processed. Wait until they finish before changing your Main Till wallet." }, { status: 409 });
    await admin.from("grants").update({
      token_enc: null, manage_url: null, authorized_at: null,
      pending_nonce: null, pending_interact_nonce: null, pending_continue_uri: null, pending_continue_token_enc: null,
    }).eq("merchant_id", user.id);
  }

  // 4. Save. connected_at only moves when the Main Till wallet changes: older payments are never split.
  const now = new Date().toISOString();
  const rows = (["main", "reserve", "owner"] as const).map((role) => ({
    merchant_id: user.id,
    role,
    wallet_url: v.urls[role],
    ...(role === "main" && mainChanged ? { connected_at: now } : {}),
  }));
  const { error } = await admin.from("wallet_configs").upsert(rows, { onConflict: "merchant_id,role" });
  if (error) {
    const dup = error.code === "23505";
    return NextResponse.json({ error: dup ? "That Main Till wallet is already connected to another SmartTill account." : error.message }, { status: dup ? 409 : 500 });
  }
  await admin.from("audit_log").insert({ merchant_id: user.id, event: "wallets_connected", detail: { mainChanged } });
  return NextResponse.json({ ok: true, assets, mainChanged });
}
