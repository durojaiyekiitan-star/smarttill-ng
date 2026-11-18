import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { syncMerchant } from "@/lib/payments/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json(await syncMerchant(user.id));
}
