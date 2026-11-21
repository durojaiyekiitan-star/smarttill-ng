import { supabaseAdmin } from "./supabase/admin";

export interface MerchantWallets {
  main?: string;
  reserve?: string;
  owner?: string;
  mainConnectedAt?: string;
}

/** The merchant's OWN wallet addresses. Nothing here comes from server settings. */
export async function getMerchantWallets(merchantId: string): Promise<MerchantWallets> {
  const { data } = await supabaseAdmin().from("wallet_configs").select("role,wallet_url,connected_at").eq("merchant_id", merchantId);
  const out: MerchantWallets = {};
  for (const w of data ?? []) {
    if (w.role === "main") {
      out.main = w.wallet_url;
      out.mainConnectedAt = w.connected_at;
    } else if (w.role === "reserve") out.reserve = w.wallet_url;
    else if (w.role === "owner") out.owner = w.wallet_url;
  }
  return out;
}

export const walletsComplete = (w: MerchantWallets) => Boolean(w.main && w.reserve && w.owner);
