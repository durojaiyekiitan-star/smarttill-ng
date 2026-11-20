import { NextResponse } from "next/server";
import { getUser, supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendWhatsApp, whatsappConfigured } from "@/lib/notify";

export async function POST(req: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

    const { customerName, walletPointer, amountUnits } = await req.json();
    const amount = Number(amountUnits) || 2;

    const sb = await supabaseServer();
    const [{ data: alloc }, { data: merchant }] = await Promise.all([
      sb.from("allocation_settings").select("reserve_percent,owner_percent").maybeSingle(),
      sb.from("merchants").select("whatsapp_number").maybeSingle(),
    ]);

    const reservePct = alloc?.reserve_percent ?? 70;
    const ownerPct = alloc?.owner_percent ?? 30;
    const reserveShare = ((amount * reservePct) / 100).toFixed(2);
    const ownerShare = (amount - Number(reserveShare)).toFixed(2);

    const admin = supabaseAdmin();
    await admin.from("audit_log").insert({
      merchant_id: user.id,
      event: "credit_installment_collected",
      ref: `CRED-${Date.now().toString().slice(-6)}`,
      detail: { customerName, walletPointer, amount, reserveShare, ownerShare },
    });

    let whatsappSent = false;
    if (merchant?.whatsapp_number && whatsappConfigured()) {
      const msg =
        `SmartTill Credit Recovery: Collected ${amount.toFixed(2)} from ${customerName} (${walletPointer}). ` +
        `Split ${reservePct}% Reserve (${reserveShare}) & ${ownerPct}% Owner (${ownerShare}).`;
      const res = await sendWhatsApp(merchant.whatsapp_number, msg);
      whatsappSent = res.ok;
    }

    return NextResponse.json({
      ok: true,
      amount: amount.toFixed(2),
      reservePct,
      ownerPct,
      reserveShare,
      ownerShare,
      whatsappSent,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Collection failed" }, { status: 500 });
  }
}
