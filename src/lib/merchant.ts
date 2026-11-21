import { supabaseAdmin } from "./supabase/admin";
import { normalizePhone } from "./notify-format";

type U = { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
const str = (v: unknown, max = 80) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Creates the merchant row and default 70/30 settings on first visit. Wallets are connected by the merchant. Idempotent. */
export async function ensureMerchant(user: U) {
  const admin = supabaseAdmin();
  const { data } = await admin.from("merchants").select("id").eq("id", user.id).maybeSingle();
  if (data) return;
  const meta = user.user_metadata ?? {};
  const fullName = str(meta.full_name);
  const shop = str(meta.shop_name) || (fullName ? `${fullName.split(" ")[0]}'s shop` : "My shop");
  const phone = typeof meta.phone === "string" ? normalizePhone(meta.phone) : null;
  await admin.from("merchants").upsert(
    { id: user.id, business_name: shop, full_name: fullName || null, phone },
    { onConflict: "id", ignoreDuplicates: true }
  );
  await admin
    .from("allocation_settings")
    .upsert({ merchant_id: user.id, reserve_percent: 70, owner_percent: 30 }, { onConflict: "merchant_id", ignoreDuplicates: true });
}
