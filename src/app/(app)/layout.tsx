import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import Nav from "@/components/Nav";
import { ModeBadge } from "@/components/ui";
import { appMode } from "@/lib/env";
import { ensureMerchant } from "@/lib/merchant";
import { getUser, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  await ensureMerchant(user);
  const sb = await supabaseServer();
  const mode = appMode();
  const { data: m } = await sb.from("merchants").select("business_name,full_name").eq("id", user.id).maybeSingle();
  const { count } = await sb.from("incoming_payments").select("id", { count: "exact", head: true }).eq("mode", mode).in("status", ["partial", "failed"]);
  const name = m?.business_name ?? "My shop";

  return (
    <div className="min-h-screen md:pl-60">
      <Nav />
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-neutral-200 bg-white px-4 md:px-8 print:hidden">
        <span className="truncate text-sm font-medium text-neutral-700">{name}</span>
        <div className="flex items-center gap-2">
          <ModeBadge mode={mode} />
          <Link href="/transactions?filter=attention" aria-label={`${count ?? 0} need attention`} className="relative rounded-full p-2 text-neutral-600 transition hover:bg-[#eef3ef] hover:text-[#0f3d2e] active:scale-90">
            <Bell size={18} strokeWidth={1.75} />
            {(count ?? 0) > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 animate-pulse rounded-full bg-red-600 ring-2 ring-white" />}
          </Link>
          <Link href="/settings" aria-label="Settings" className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0f3d2e] text-sm font-medium text-white transition hover:bg-[#165a43] active:scale-90">
            {(m?.full_name || name).charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-8">{children}</main>
    </div>
  );
}
