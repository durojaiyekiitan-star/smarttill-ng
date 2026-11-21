import { randomBytes } from "node:crypto";
import { aggregateStatus, type LegStatus } from "../allocation";
import { appMode } from "../env";
import { allocateIncoming, type Ports } from "../processor";
import { supabaseAdmin } from "../supabase/admin";
import { notifyTransaction } from "../notify";
import { getMerchantWallets, walletsComplete } from "../wallets";
import {
  getOutgoingPayment,
  getOutgoingToken,
  hasActiveGrant,
  judgeOutgoing,
  listMainTillIncoming,
  sendLeg,
} from "../openpayments/service";

function describeError(e: unknown): string {
  const x = e as { message?: string; status?: number; code?: string; description?: string; validationErrors?: unknown; details?: unknown; cause?: unknown };
  const parts = [x?.message ?? String(e)];
  if (x?.status) parts.push(`status ${x.status}`);
  if (x?.code) parts.push(`code ${x.code}`);
  if (x?.description) parts.push(x.description);
  if (x?.validationErrors) parts.push(JSON.stringify(x.validationErrors));
  if (x?.details) parts.push(JSON.stringify(x.details));
  if (x?.cause) parts.push(String((x.cause as { message?: string })?.message ?? x.cause));
  return parts.join(" | ");
}

export interface SyncSummary {
  mode: string;
  busy?: boolean;
  needsGrant?: boolean;
  needsWallets?: boolean;
  ingested: number;
  processed: number;
  reconciled: number;
  seen?: { id: string; received: string; completed: boolean; createdAt: string }[];
  error?: string;
}

const admin = () => supabaseAdmin();

async function audit(merchantId: string, event: string, ref?: string, detail?: unknown) {
  await admin().from("audit_log").insert({ merchant_id: merchantId, event, ref: ref ?? null, detail: detail ?? null });
}

async function refreshParent(incomingId: string) {
  const { data: legs } = await admin().from("outgoing_payments").select("status").eq("incoming_payment_id", incomingId);
  if (!legs?.length) return;
  await admin()
    .from("incoming_payments")
    .update({ status: aggregateStatus(legs.map((l) => l.status as LegStatus)), updated_at: new Date().toISOString() })
    .eq("id", incomingId)
    .neq("status", "pending");
}

function makePorts(merchantId: string, inc: { id: string; reference: string; asset_code: string; asset_scale: number }, wallets: Record<string, string>): Ports {
  return {
    async claim(id) {
      const { data } = await admin()
        .from("incoming_payments")
        .update({ status: "processing", updated_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      return (data?.length ?? 0) === 1;
    },
    async getLegStatuses(id) {
      const { data } = await admin().from("outgoing_payments").select("role,status").eq("incoming_payment_id", id);
      return Object.fromEntries((data ?? []).map((l) => [l.role, l.status]));
    },
    async upsertLeg(id, role, d) {
      await admin()
        .from("outgoing_payments")
        .upsert(
          {
            incoming_payment_id: id,
            merchant_id: merchantId,
            role,
            debit_value: d.debit.toString(),
            asset_code: inc.asset_code,
            asset_scale: inc.asset_scale,
            status: d.status ?? "processing",
            ...(d.opUrl ? { op_url: d.opUrl } : {}),
            ...(d.quoteId ? { quote_id: d.quoteId } : {}),
            ...(d.sentValue ? { sent_value: d.sentValue } : {}),
            ...(d.receivedValue ? { received_value: d.receivedValue } : {}),
            error: d.error ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "incoming_payment_id,role" }
        );
    },
    async sendLeg(role, debit) {
      return sendLeg({
        merchantId,
        role,
        debit,
        assetCode: inc.asset_code,
        assetScale: inc.asset_scale,
        senderWalletUrl: wallets.main,
        receiverWalletUrl: wallets[role],
        reference: inc.reference,
        save: async (patch) => {
          await admin()
            .from("outgoing_payments")
            .update({
              ...(patch.quoteId ? { quote_id: patch.quoteId } : {}),
              ...(patch.opUrl ? { op_url: patch.opUrl } : {}),
              updated_at: new Date().toISOString(),
            })
            .eq("incoming_payment_id", inc.id)
            .eq("role", role);
        },
      });
    },
    async setIncomingStatus(id, status) {
      await admin().from("incoming_payments").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    },
    async audit(event, detail) {
      await audit(merchantId, event, inc.reference, detail);
    },
  };
}

async function processPending(merchantId: string, onlyId?: string): Promise<number> {
  let q = admin().from("incoming_payments").select("*").eq("merchant_id", merchantId).eq("mode", "testnet").eq("status", "pending").order("occurred_at");
  if (onlyId) q = q.eq("id", onlyId);
  const { data: pending } = await q;
  if (!pending?.length) return 0;
  const { data: wcs } = await admin().from("wallet_configs").select("role,wallet_url").eq("merchant_id", merchantId);
  const wallets = Object.fromEntries((wcs ?? []).map((w) => [w.role, w.wallet_url]));
  if (!wallets.main || !wallets.reserve || !wallets.owner) return 0;
  let n = 0;
  for (const inc of pending) {
    const res = await allocateIncoming(makePorts(merchantId, inc, wallets), {
      id: inc.id,
      received: BigInt(inc.received_value),
      ownerPercent: inc.owner_percent,
    });
    if (res !== "duplicate") {
      n++;
      await notifyTransaction(merchantId, inc.id).catch(() => {});
    }
  }
  return n;
}

async function reconcile(merchantId: string): Promise<number> {
  const { data: legs } = await admin()
    .from("outgoing_payments")
    .select("*")
    .eq("merchant_id", merchantId)
    .eq("status", "processing")
    .not("op_url", "is", null);
  if (!legs?.length) return 0;
  let token: string;
  try {
    token = await getOutgoingToken(merchantId);
  } catch {
    return 0;
  }
  let n = 0;
  for (const leg of legs) {
    try {
      const j = judgeOutgoing(await getOutgoingPayment(leg.op_url, token));
      if (j.status !== "processing") {
        await admin()
          .from("outgoing_payments")
          .update({ status: j.status, sent_value: j.sentValue, received_value: j.receivedValue, error: null, updated_at: new Date().toISOString() })
          .eq("id", leg.id);
        await refreshParent(leg.incoming_payment_id);
        await notifyTransaction(merchantId, leg.incoming_payment_id).catch(() => {});
        await audit(merchantId, "leg_reconciled", leg.op_url, { status: j.status });
        n++;
      }
    } catch {
      // leave as processing
    }
  }
  return n;
}

async function ingest(merchantId: string, merchantCreatedAt: string, summary: SyncSummary) {
  const payments = await listMainTillIncoming(merchantId);
  summary.seen = payments.slice(-10).map((p) => ({ id: p.id, received: p.receivedAmount.value, completed: Boolean(p.completed), createdAt: p.createdAt }));
  const { data: settings } = await admin().from("allocation_settings").select("*").eq("merchant_id", merchantId).single();
  if (!settings) throw new Error("Allocation settings missing");
  const rows = [];
  for (const p of payments) {
    const received = BigInt(p.receivedAmount.value);
    if (received === 0n) continue;
    const reached = p.incomingAmount ? received >= BigInt(p.incomingAmount.value) : false;
    if (!p.completed && !reached) continue; // still receiving
    if (new Date(p.createdAt) < new Date(merchantCreatedAt)) continue; // ignore anything received before this wallet was connected
    rows.push({
      merchant_id: merchantId,
      mode: "testnet",
      reference: "ST-" + randomBytes(4).toString("hex").toUpperCase(),
      op_url: p.id,
      received_value: received.toString(),
      asset_code: p.receivedAmount.assetCode,
      asset_scale: p.receivedAmount.assetScale,
      description: p.metadata && typeof p.metadata === "object" ? String((p.metadata as Record<string, unknown>).description ?? "") || null : null,
      reserve_percent: settings.reserve_percent,
      owner_percent: settings.owner_percent,
      status: "pending",
      occurred_at: p.createdAt,
    });
  }
  if (!rows.length) return;
  // Unique (merchant_id, mode, op_url) makes this idempotent: already-seen payments are ignored.
  const { data } = await admin()
    .from("incoming_payments")
    .upsert(rows, { onConflict: "merchant_id,mode,op_url", ignoreDuplicates: true })
    .select("reference");
  summary.ingested = data?.length ?? 0;
  for (const r of data ?? []) await audit(merchantId, "incoming_detected", r.reference);
}

async function withLock<T>(merchantId: string, fn: (merchantCreatedAt: string) => Promise<T>): Promise<T | "busy"> {
  const now = new Date();
  const { data } = await admin()
    .from("merchants")
    .update({ sync_lock_until: new Date(now.getTime() + 90_000).toISOString() })
    .eq("id", merchantId)
    .or(`sync_lock_until.is.null,sync_lock_until.lt.${now.toISOString()}`)
    .select("created_at")
    .maybeSingle();
  if (!data) return "busy";
  try {
    return await fn(data.created_at);
  } finally {
    await admin().from("merchants").update({ sync_lock_until: null }).eq("id", merchantId);
  }
}

export async function syncMerchant(merchantId: string): Promise<SyncSummary> {
  const summary: SyncSummary = { mode: appMode(), ingested: 0, processed: 0, reconciled: 0 };
  if (appMode() === "demo") return summary;
  const res = await withLock(merchantId, async (createdAt) => {
    try {
      const w = await getMerchantWallets(merchantId);
      if (!walletsComplete(w)) {
        summary.needsWallets = true; // nothing to watch until the merchant connects their own wallets
        return;
      }
      summary.reconciled = await reconcile(merchantId);
      await ingest(merchantId, w.mainConnectedAt ?? createdAt, summary);
      if (await hasActiveGrant(merchantId)) summary.processed = await processPending(merchantId);
      else summary.needsGrant = true; // leave payments pending until the merchant authorises transfers
    } catch (e) {
      summary.error = describeError(e);
    }
  });
  if (res === "busy") summary.busy = true;
  return summary;
}

/** Retries only legs that FAILED (confirmed not sent). Completed or in-flight legs are never touched. */
export async function retryFailedLegs(merchantId: string, incomingId: string): Promise<SyncSummary> {
  const summary: SyncSummary = { mode: appMode(), ingested: 0, processed: 0, reconciled: 0 };
  const res = await withLock(merchantId, async () => {
    try {
      if (!walletsComplete(await getMerchantWallets(merchantId))) {
        summary.needsWallets = true;
        return;
      }
      if (!(await hasActiveGrant(merchantId))) {
        summary.needsGrant = true;
        return;
      }
      const { data: failed } = await admin()
        .from("outgoing_payments")
        .select("id,op_url")
        .eq("incoming_payment_id", incomingId)
        .eq("merchant_id", merchantId)
        .eq("status", "failed");
      if (!failed?.length) return;
      for (const l of failed) await audit(merchantId, "retry_failed_leg", incomingId, { previous_op_url: l.op_url });
      await admin().from("outgoing_payments").update({ status: "pending", op_url: null, quote_id: null, error: null }).in("id", failed.map((l) => l.id));
      await admin().from("incoming_payments").update({ status: "pending", notified_at: null }).eq("id", incomingId).eq("merchant_id", merchantId);
      summary.processed = await processPending(merchantId, incomingId);
    } catch (e) {
      summary.error = describeError(e);
    }
  });
  if (res === "busy") summary.busy = true;
  return summary;
}
