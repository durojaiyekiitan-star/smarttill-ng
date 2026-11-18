import { NextRequest, NextResponse } from "next/server";
import { describeError } from "@/lib/errors";
import { getUser } from "@/lib/supabase/server";
import { startOutgoingGrant } from "@/lib/openpayments/service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const redirect = await startOutgoingGrant(user.id, req.nextUrl.origin);
    return NextResponse.json({ redirect });
  } catch (e) {
    console.error("[grant start]", e);
    return NextResponse.json({ error: describeError(e) }, { status: 500 });
  }
}
