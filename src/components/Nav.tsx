"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Check, LayoutDashboard, PieChart, Settings, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/transactions", label: "Transactions", Icon: ArrowLeftRight },
  { href: "/allocation", label: "Allocation", Icon: PieChart },
  { href: "/wallets", label: "Wallets", Icon: Wallet },
  { href: "/settings", label: "Settings", Icon: Settings },
];

export default function Nav() {
  const path = usePathname();
  const active = (href: string) => path === href || path.startsWith(href + "/");
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-neutral-200 bg-white px-4 py-6 md:flex print:hidden">
        <Link href="/dashboard" className="group mb-8 flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f3d2e] text-white transition group-hover:rotate-6 group-hover:bg-[#165a43]">
            <Check size={18} strokeWidth={2.5} />
          </span>
          <span className="text-lg font-semibold tracking-tight text-[#0f3d2e]">SmartTill</span>
        </Link>
        <nav className="flex flex-col gap-1">
          {ITEMS.map(({ href, label, Icon }) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
              className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150 ${active(href) ? "bg-[#0f3d2e] text-white shadow-sm" : "text-neutral-600 hover:bg-[#eef3ef] hover:text-[#0f3d2e]"}`}>
              <Icon size={18} strokeWidth={1.75} className="transition group-hover:scale-110" /> {label}
            </Link>
          ))}
        </nav>
      </aside>
      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-neutral-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden print:hidden">
        {ITEMS.map(({ href, label, Icon }) => (
          <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition active:scale-95 ${active(href) ? "text-[#0f3d2e]" : "text-neutral-500"}`}>
            <Icon size={20} strokeWidth={active(href) ? 2.25 : 1.75} /> {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
