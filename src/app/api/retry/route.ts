import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { retryFailedLegs } from "@/lib/payments/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const { incomingId } = await req.json().catch(() => ({}));
  if (typeof incomingId !== "string") return NextResponse.json({ error: "incomingId required" }, { status: 400 });
  return NextResponse.json(await retryFailedLegs(user.id, incomingId));
}
