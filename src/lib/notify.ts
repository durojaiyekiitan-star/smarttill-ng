import { buildMessage } from "./notify-format";
import { supabaseAdmin } from "./supabase/admin";

export function whatsappConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_WHATSAPP_FROM);
}

type Sent = { ok: true } | { ok: false; error: string };

/** Sends a WhatsApp message through the Twilio API. Credentials stay on the server. */
export async function sendWhatsApp(to: string, body: string): Promise<Sent> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!sid || !token || !from) return { ok: false, error: "WhatsApp is not set up on the server yet (missing Twilio settings)." };
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${sid}:${token}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ From: `whatsapp:${from.replace(/^whatsapp:/, "")}`, To: `whatsapp:${to}`, Body: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.message ?? `Twilio error ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not reach Twilio" };
  }
}

/** Sends one alert per finished transaction. notified_at is claimed atomically so it can never double-send. */
export async function notifyTransaction(merchantId: string, incomingId: string): Promise<void> {
  const admin = supabaseAdmin();
  const { data: m } = await admin.from("merchants").select("whatsapp_number").eq("id", merchantId).maybeSingle();
  if (!m?.whatsapp_number) return;
  const { data: tx } = await admin
    .from("incoming_payments")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", incomingId)
    .eq("merchant_id", merchantId)
    .in("status", ["completed", "partial", "failed"])
    .is("notified_at", null)
    .select("*")
    .maybeSingle();
  if (!tx) return;
  const { data: legs } = await admin.from("outgoing_payments").select("role,status,debit_value").eq("incoming_payment_id", incomingId);
  const r = await sendWhatsApp(m.whatsapp_number, buildMessage(tx, legs ?? []));
  await admin.from("audit_log").insert({
    merchant_id: merchantId,
    event: r.ok ? "whatsapp_sent" : "whatsapp_failed",
    ref: tx.reference,
    detail: r.ok ? null : { error: r.error },
  });
}
