import { NextRequest, NextResponse } from "next/server";
import { BUSINESS_TYPES } from "@/lib/kyc";
import { normalizePhone } from "@/lib/notify-format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const clean = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

  const full_name = clean(b.full_name, 80);
  const business_name = clean(b.business_name, 80);
  const business_type = clean(b.business_type, 40);
  const location = clean(b.location, 120);
  const phoneRaw = clean(b.phone, 30);

  if (full_name.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 400 });
  if (business_name.length < 2) return NextResponse.json({ error: "Enter your shop name." }, { status: 400 });
  if (business_type && !BUSINESS_TYPES.includes(business_type)) return NextResponse.json({ error: "Choose a business type from the list." }, { status: 400 });
  const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
  if (phoneRaw && !phone) return NextResponse.json({ error: "Enter a valid phone number, like 0801 234 5678." }, { status: 400 });

  const admin = supabaseAdmin();
  const { error } = await admin
    .from("merchants")
    .update({ full_name, business_name, business_type: business_type || null, location: location || null, phone })
    .eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await admin.from("audit_log").insert({ merchant_id: user.id, event: "profile_updated" });
  return NextResponse.json({ ok: true, phone });
}
