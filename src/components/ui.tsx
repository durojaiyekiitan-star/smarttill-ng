import Link from "next/link";
import { formatMinor } from "@/lib/money";

export const lift =
  "transition duration-200 hover:-translate-y-0.5 hover:border-neutral-300 hover:shadow-[0_10px_28px_-12px_rgba(15,61,46,0.25)]";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-neutral-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,61,46,0.05)] ${className}`}>{children}</section>;
}

export function PageTitle({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-neutral-500">{sub}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </div>
  );
}

const STATUS: Record<string, { label: string; cls: string; pulse?: boolean }> = {
  completed: { label: "Completed", cls: "bg-green-50 text-green-800 ring-green-200" },
  pending: { label: "Pending", cls: "bg-amber-50 text-amber-800 ring-amber-200", pulse: true },
  processing: { label: "Processing", cls: "bg-amber-50 text-amber-800 ring-amber-200", pulse: true },
  partial: { label: "Partly completed", cls: "bg-orange-50 text-orange-800 ring-orange-200" },
  failed: { label: "Failed", cls: "bg-red-50 text-red-800 ring-red-200" },
  skipped: { label: "Nothing to send", cls: "bg-neutral-100 text-neutral-600 ring-neutral-200" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${s.pulse ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: string }) {
  return mode === "demo" ? (
    <span className="rounded-full bg-neutral-900 px-2.5 py-0.5 text-xs font-medium text-white">Demo</span>
  ) : (
    <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-800 ring-1 ring-inset ring-green-200">Testnet</span>
  );
}

export function Amount({ value, scale, code, className = "" }: { value: string; scale: number; code: string; className?: string }) {
  return (
    <span className={`tabular-nums ${className}`}>
      {formatMinor(value, scale)} <span className="text-neutral-400">{code}</span>
    </span>
  );
}

export function when(iso: string) {
  return new Date(iso).toLocaleString("en-NG", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" });
}

const base = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition duration-150 active:scale-[0.97] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d2e] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";
export const btnPrimary = `${base} bg-[#0f3d2e] text-white shadow-sm hover:bg-[#165a43] hover:shadow-md`;
export const btnSecondary = `${base} border border-neutral-300 bg-white text-neutral-800 hover:border-neutral-400 hover:bg-neutral-50`;

export function EmptyState({ title, body, href, cta }: { title: string; body: string; href?: string; cta?: string }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-neutral-500">{body}</p>
      {href && cta && <Link href={href} className={`${btnSecondary} mt-4`}>{cta}</Link>}
    </div>
  );
}
