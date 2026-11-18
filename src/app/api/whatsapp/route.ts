import { NextRequest, NextResponse } from "next/server";
import { sendWhatsApp } from "@/lib/notify";
import { normalizePhone } from "@/lib/notify-format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  if (typeof body.number === "string") {
    const raw = body.number.trim();
    const number = raw === "" ? null : normalizePhone(raw);
    if (raw !== "" && !number) return NextResponse.json({ error: "Enter a valid number, like 0801 234 5678 or +234 801 234 5678." }, { status: 400 });
    const { error } = await admin.from("merchants").update({ whatsapp_number: number }).eq("id", user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!body.test) return NextResponse.json({ ok: true, number });
  }

  if (body.test) {
    const { data: m } = await admin.from("merchants").select("whatsapp_number").eq("id", user.id).maybeSingle();
    if (!m?.whatsapp_number) return NextResponse.json({ error: "Save your WhatsApp number first." }, { status: 400 });
    const r = await sendWhatsApp(m.whatsapp_number, "SmartTill NG\n✅ WhatsApp alerts are on. You will get a receipt here for every sale.");
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: 502 });
    return NextResponse.json({ ok: true, number: m.whatsapp_number });
  }
  return NextResponse.json({ error: "Nothing to do" }, { status: 400 });
}
