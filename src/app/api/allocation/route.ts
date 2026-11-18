import { NextRequest, NextResponse } from "next/server";
import { validatePercentages } from "@/lib/allocation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const v = validatePercentages(body?.reserve_percent, body?.owner_percent);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  const admin = supabaseAdmin();
  const { error } = await admin
    .from("allocation_settings")
    .upsert({ merchant_id: user.id, reserve_percent: v.reserve, owner_percent: v.owner, updated_at: new Date().toISOString() }, { onConflict: "merchant_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_log").insert({ merchant_id: user.id, event: "allocation_updated", detail: { reserve: v.reserve, owner: v.owner } });
  return NextResponse.json({ ok: true, reserve_percent: v.reserve, owner_percent: v.owner });
}
