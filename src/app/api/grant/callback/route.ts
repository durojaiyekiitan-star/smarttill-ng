import { NextRequest, NextResponse } from "next/server";
import { describeError } from "@/lib/errors";
import { getUser } from "@/lib/supabase/server";
import { finishOutgoingGrant } from "@/lib/openpayments/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const done = (q: string) => NextResponse.redirect(new URL(`/wallets?${q}`, origin));
  const user = await getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  console.log("[grant callback] query:", Object.fromEntries(req.nextUrl.searchParams.entries()));
  const ref = req.nextUrl.searchParams.get("interact_ref");
  if (!ref) {
    const why = req.nextUrl.searchParams.get("result") ?? "no interact_ref returned";
    return done("grant=error&msg=" + encodeURIComponent(`Authorisation was not completed (${why}).`));
  }
  try {
    await finishOutgoingGrant(user.id, ref, req.nextUrl.searchParams.get("hash"));
    return done("grant=ok");
  } catch (e) {
    console.error("[grant callback]", e);
    return done("grant=error&msg=" + encodeURIComponent(describeError(e)));
  }
}
