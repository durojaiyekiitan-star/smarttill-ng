import { isPendingGrant } from "@interledger/open-payments";
import type { IncomingPayment } from "@interledger/open-payments";
import { createHash, randomUUID } from "node:crypto";
import { decrypt, encrypt } from "../crypto";
import { must } from "../env";
import { supabaseAdmin } from "../supabase/admin";
import { NotSentError, type LegOutcome } from "../processor";
import type { Role } from "../allocation";
import { getClient, getWallet } from "./client";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/* ---------- Incoming payments on Main Till ---------- */

export async function listMainTillIncoming(merchantId: string): Promise<IncomingPayment[]> {
  const client = await getClient();
  const wallet = await getWallet(must("MAIN_TILL_WALLET_URL"));
  const token = await getOutgoingToken(merchantId);
  const all: IncomingPayment[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 10; i++) {
    const page = await client.incomingPayment.list(
      { url: wallet.resourceServer, walletAddress: wallet.id, accessToken: token },
      cursor ? { first: 50, cursor } : { first: 50 }
    );
    all.push(...page.result);
    if (!page.pagination.hasNextPage || !page.pagination.endCursor) break;
    cursor = page.pagination.endCursor;
  }
  return all;
}

/* ---------- Outgoing payment authorisation (interactive, merchant consent) ---------- */

export async function startOutgoingGrant(merchantId: string, origin: string): Promise<string> {
  const client = await getClient();
  const wallet = await getWallet(must("MAIN_TILL_WALLET_URL"));
  const units = BigInt(process.env.GRANT_LIMIT_UNITS || "1000");
  const limit = {
    value: (units * 10n ** BigInt(wallet.assetScale)).toString(),
    assetCode: wallet.assetCode,
    assetScale: wallet.assetScale,
  };
  const nonce = randomUUID();
  const grant = await client.grant.request(
    { url: wallet.authServer },
    {
      access_token: {
        access: [
          { type: "outgoing-payment", actions: ["create", "read"], identifier: wallet.id, limits: { debitAmount: limit } },
          { type: "incoming-payment", actions: ["list", "list-all", "read", "read-all"], identifier: wallet.id },
        ],
      },
      interact: { start: ["redirect"], finish: { method: "redirect", uri: `${origin}/api/grant/callback`, nonce } },
    }
  );
  if (!isPendingGrant(grant)) throw new Error("Expected an interactive grant from the authorisation server.");
  await supabaseAdmin()
    .from("grants")
    .upsert(
      {
        merchant_id: merchantId,
        pending_nonce: nonce,
        pending_interact_nonce: grant.interact.finish,
        pending_continue_uri: grant.continue.uri,
        pending_continue_token_enc: encrypt(grant.continue.access_token.value),
        pending_auth_server: wallet.authServer,
        limit_value: limit.value,
        asset_code: limit.assetCode,
        asset_scale: limit.assetScale,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "merchant_id" }
    );
  return grant.interact.redirect;
}

function hashVariants(nonce: string, interactNonce: string, ref: string, authServer: string): string[] {
  return [authServer, authServer.replace(/\/$/, ""), authServer.replace(/\/$/, "") + "/"].map((uri) =>
    createHash("sha256").update(`${nonce}\n${interactNonce}\n${ref}\n${uri}`).digest("base64")
  );
}

export async function finishOutgoingGrant(merchantId: string, interactRef: string, hash: string | null) {
  const admin = supabaseAdmin();
  const { data: g } = await admin.from("grants").select("*").eq("merchant_id", merchantId).maybeSingle();
  if (!g?.pending_continue_uri) throw new Error("No authorisation in progress. Start again from the Wallets page.");
  if (!hash || !hashVariants(g.pending_nonce, g.pending_interact_nonce, interactRef, g.pending_auth_server).includes(hash)) {
    throw new Error("Authorisation response could not be verified. Start again.");
  }
  const client = await getClient();
  const fin = await client.grant.continue(
    { url: g.pending_continue_uri, accessToken: decrypt(g.pending_continue_token_enc) },
    { interact_ref: interactRef }
  );
  if (isPendingGrant(fin)) throw new Error("Authorisation was not approved.");
  await admin
    .from("grants")
    .update({
      token_enc: encrypt(fin.access_token.value),
      manage_url: fin.access_token.manage,
      authorized_at: new Date().toISOString(),
      pending_nonce: null,
      pending_interact_nonce: null,
      pending_continue_uri: null,
      pending_continue_token_enc: null,
      updated_at: new Date().toISOString(),
    })
    .eq("merchant_id", merchantId);
}

export async function hasActiveGrant(merchantId: string): Promise<boolean> {
  const { data } = await supabaseAdmin().from("grants").select("token_enc").eq("merchant_id", merchantId).maybeSingle();
  return Boolean(data?.token_enc);
}

/** Access tokens are short-lived, so rotate before use and persist the new token. */
export async function getOutgoingToken(merchantId: string): Promise<string> {
  const admin = supabaseAdmin();
  const { data: g } = await admin.from("grants").select("token_enc, manage_url").eq("merchant_id", merchantId).maybeSingle();
  if (!g?.token_enc) throw new NotSentError("Outgoing payments are not authorised yet. Authorise them on the Wallets page.");
  try {
    const client = await getClient();
    const rotated = await client.token.rotate({ url: g.manage_url, accessToken: decrypt(g.token_enc) });
    await admin
      .from("grants")
      .update({
        token_enc: encrypt(rotated.access_token.value),
        manage_url: rotated.access_token.manage,
        updated_at: new Date().toISOString(),
      })
      .eq("merchant_id", merchantId);
    return rotated.access_token.value;
  } catch (e) {
    throw new NotSentError(`Authorisation expired or was revoked. Re-authorise on the Wallets page. (${msg(e)})`);
  }
}

/* ---------- One allocation leg: Main Till -> Business Reserve / Owner Allocation ---------- */

export function judgeOutgoing(p: {
  failed?: boolean;
  sentAmount: { value: string };
  debitAmount: { value: string };
  receiveAmount: { value: string };
}): Pick<LegOutcome, "status" | "sentValue" | "receivedValue"> {
  const base = { sentValue: p.sentAmount.value, receivedValue: p.receiveAmount.value };
  if (p.failed) return { status: "failed", ...base };
  if (BigInt(p.sentAmount.value) >= BigInt(p.debitAmount.value)) return { status: "completed", ...base };
  return { status: "processing", ...base };
}

export async function getOutgoingPayment(url: string, accessToken: string) {
  const client = await getClient();
  return client.outgoingPayment.get({ url, accessToken });
}

export async function sendLeg(a: {
  merchantId: string;
  role: Role;
  debit: bigint;
  assetCode: string;
  assetScale: number;
  receiverWalletUrl: string;
  reference: string;
  save: (patch: Partial<LegOutcome>) => Promise<void>;
}): Promise<LegOutcome> {
  const client = await getClient();
  let sender, quoteId: string, outgoingToken: string;

  // Everything before the outgoing payment exists is safe to retry, so failures here are NotSentError.
  try {
    sender = await getWallet(must("MAIN_TILL_WALLET_URL"));
    const receiver = await getWallet(a.receiverWalletUrl);

    const inGrant = await client.grant.request(
      { url: receiver.authServer },
      { access_token: { access: [{ type: "incoming-payment", actions: ["create", "read", "complete"] }] } }
    );
    if (isPendingGrant(inGrant)) throw new Error("Receiver required interactive consent (unexpected).");
    const incoming = await client.incomingPayment.create(
      { url: receiver.resourceServer, accessToken: inGrant.access_token.value },
      { walletAddress: receiver.id, metadata: { description: `SmartTill ${a.reference} ${a.role}` } }
    );

    const qGrant = await client.grant.request(
      { url: sender.authServer },
      { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } }
    );
    if (isPendingGrant(qGrant)) throw new Error("Quote grant required interactive consent (unexpected).");
    const quote = await client.quote.create(
      { url: sender.resourceServer, accessToken: qGrant.access_token.value },
      {
        method: "ilp",
        walletAddress: sender.id,
        receiver: incoming.id,
        debitAmount: { value: a.debit.toString(), assetCode: a.assetCode, assetScale: a.assetScale },
      }
    );
    quoteId = quote.id;
    outgoingToken = await getOutgoingToken(a.merchantId);
    await a.save({ quoteId });
  } catch (e) {
    throw e instanceof NotSentError ? e : new NotSentError(msg(e));
  }

  // From here a payment may exist, so any uncertain failure is NOT a NotSentError.
  let op;
  try {
    op = await client.outgoingPayment.create(
      { url: sender.resourceServer, accessToken: outgoingToken },
      { walletAddress: sender.id, quoteId }
    );
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (typeof status === "number" && status >= 400 && status < 500) {
      throw new NotSentError(`Payment rejected by the wallet: ${msg(e)}`); // clear rejection, nothing created
    }
    throw e;
  }
  await a.save({ opUrl: op.id, quoteId });

  // Verify: read the payment back instead of trusting the create response.
  let last: LegOutcome = { status: "processing", opUrl: op.id, quoteId };
  for (let i = 0; i < 8; i++) {
    try {
      const p = await getOutgoingPayment(op.id, outgoingToken);
      last = { opUrl: op.id, quoteId, ...judgeOutgoing(p) };
      if (last.status !== "processing") return last;
    } catch {
      // keep as processing; the next sync reconciles it
    }
    await sleep(1500);
  }
  return last;
}
