import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { splitAmount } from "@/lib/allocation";
import { appMode } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";
import { notifyTransaction } from "@/lib/notify";

export const dynamic = "force-dynamic";

/** DEMO MODE ONLY. Creates clearly flagged synthetic rows (mode = 'demo'). No real transfer happens. */
export async function POST() {
  if (appMode() !== "demo") return NextResponse.json({ error: "Simulation is only available when APP_MODE=demo" }, { status: 403 });
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const admin = supabaseAdmin();
  const { data: s } = await admin.from("allocation_settings").select("*").eq("merchant_id", user.id).single();
  if (!s) return NextResponse.json({ error: "Settings missing" }, { status: 500 });
  const received = BigInt(500 + Math.floor(Math.random() * 9500) * 10); // 5.00 to ~100.00
  const split = splitAmount(received, s.owner_percent);
  const { data: inc, error } = await admin
    .from("incoming_payments")
    .insert({
      merchant_id: user.id, mode: "demo", reference: "DEMO-" + randomBytes(3).toString("hex").toUpperCase(),
      op_url: `demo:${randomUUID()}`, received_value: received.toString(), asset_code: "DEMO", asset_scale: 2,
      description: "Simulated sale", reserve_percent: s.reserve_percent, owner_percent: s.owner_percent,
      status: "completed", occurred_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !inc) return NextResponse.json({ error: error?.message ?? "Insert failed" }, { status: 500 });
  await admin.from("outgoing_payments").insert(
    (["reserve", "owner"] as const).map((role) => ({
      incoming_payment_id: inc.id, merchant_id: user.id, role, debit_value: split[role].toString(),
      asset_code: "DEMO", asset_scale: 2, status: "completed", sent_value: split[role].toString(),
      received_value: split[role].toString(), error: "SIMULATED, no real transfer",
    }))
  );
  await notifyTransaction(user.id, inc.id).catch(() => {});
  return NextResponse.json({ ok: true });
}
