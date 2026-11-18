import { Check, Lock } from "lucide-react";
import { Card, ModeBadge, PageTitle } from "@/components/ui";
import ProfileForm from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SmallButtons";
import WhatsAppForm from "@/components/WhatsAppForm";
import { appMode } from "@/lib/env";
import { kycChecklist } from "@/lib/kyc";
import { whatsappConfigured } from "@/lib/notify";
import { getUser, supabaseServer } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const user = (await getUser())!;
  const sb = await supabaseServer();
  const { data: m } = await sb.from("merchants").select("business_name,full_name,phone,business_type,location,whatsapp_number").maybeSingle();
  const mode = appMode();
  const k = kycChecklist(m ?? {});

  return (
    <>
      <PageTitle title="Settings" />
      <div className="grid max-w-3xl gap-4">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Profile and verification</h2>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${k.tier1 ? "bg-green-50 text-green-800 ring-1 ring-inset ring-green-200" : "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"}`}>
              Tier 1 · {k.done} of {k.total}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
            <div className="h-full rounded-full bg-[#0f3d2e] transition-all duration-500" style={{ width: `${(k.done / k.total) * 100}%` }} />
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {k.items.map((i) => (
              <li key={i.key} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ${i.done ? "bg-[#eef3ef] text-[#0f3d2e]" : "bg-neutral-100 text-neutral-500"}`}>
                {i.done && <Check size={12} strokeWidth={3} />}{i.label}
              </li>
            ))}
          </ul>
          <div className="mt-5">
            <ProfileForm initial={{ full_name: m?.full_name ?? "", phone: m?.phone ?? "", business_name: m?.business_name ?? "", business_type: m?.business_type ?? "", location: m?.location ?? "" }} />
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-neutral-50 p-3">
            <Lock size={16} className="mt-0.5 shrink-0 text-neutral-400" />
            <p className="text-sm text-neutral-500"><span className="font-medium text-neutral-700">Tier 2, ID check (BVN or NIN).</span> Not connected. It needs a licensed verification partner. Tier 1 details are self-declared and not verified.</p>
          </div>
        </Card>

        <Card>
          <div id="whatsapp" className="scroll-mt-24">
            <h2 className="font-medium">WhatsApp alerts</h2>
            <p className="mb-4 mt-1 text-sm text-neutral-500">A receipt on WhatsApp the moment a sale is split.</p>
            <WhatsAppForm initial={m?.whatsapp_number ?? ""} configured={whatsappConfigured()} />
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <h2 className="font-medium">Account</h2>
            <p className="mt-2 break-all text-sm text-neutral-500">{user.email}</p>
            <div className="mt-4"><SignOutButton /></div>
          </Card>
          <Card>
            <h2 className="font-medium">Mode</h2>
            <div className="mt-2"><ModeBadge mode={mode} /></div>
            <p className="mt-2 text-sm text-neutral-500">{mode === "demo" ? "Simulated sales. No money moves." : "Real Open Payments transfers between test wallets."}</p>
          </Card>
        </div>
      </div>
    </>
  );
}
