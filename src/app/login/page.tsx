"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { normalizePhone } from "@/lib/notify-format";
import { btnPrimary } from "@/components/ui";

const input = "mt-1.5 h-11 w-full rounded-xl border border-neutral-300 bg-white px-3 transition focus:border-[#0f3d2e] focus:outline-none focus:ring-2 focus:ring-[#0f3d2e]/20";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [f, setF] = useState({ full_name: "", shop_name: "", phone: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (f.password.length < 8) return setErr("Use a password with at least 8 characters.");
    let phone = "";
    if (mode === "up") {
      if (f.full_name.trim().length < 2) return setErr("Enter your full name.");
      if (f.shop_name.trim().length < 2) return setErr("Enter your shop name.");
      const n = normalizePhone(f.phone);
      if (!n) return setErr("Enter a valid phone number, like 0801 234 5678.");
      phone = n;
    }
    setBusy(true);
    const sb = supabaseBrowser();
    const { data, error } =
      mode === "in"
        ? await sb.auth.signInWithPassword({ email: f.email, password: f.password })
        : await sb.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.full_name.trim(), shop_name: f.shop_name.trim(), phone } } });
    setBusy(false);
    if (error) return setErr(error.message);
    if (!data.session) return setErr("Account created. Confirm your email, then sign in.");
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-10">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0f3d2e] text-white"><Check size={20} strokeWidth={2.5} /></span>
        <h1 className="text-3xl font-semibold tracking-tight text-[#0f3d2e]">SmartTill</h1>
      </div>
      <p className="mt-2 text-neutral-500">Your business money, under control.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        {mode === "up" && (
          <>
            <label className="block text-sm font-medium">Full name<input required autoComplete="name" value={f.full_name} onChange={set("full_name")} className={input} /></label>
            <label className="block text-sm font-medium">Shop name<input required value={f.shop_name} onChange={set("shop_name")} className={input} /></label>
            <label className="block text-sm font-medium">Phone number<input required type="tel" autoComplete="tel" placeholder="0801 234 5678" value={f.phone} onChange={set("phone")} className={input} /></label>
          </>
        )}
        <label className="block text-sm font-medium">Email<input type="email" required autoComplete="email" value={f.email} onChange={set("email")} className={input} /></label>
        <label className="block text-sm font-medium">Password<input type="password" required autoComplete={mode === "in" ? "current-password" : "new-password"} value={f.password} onChange={set("password")} className={input} /></label>
        {err && <p role="alert" className="text-sm text-red-700">{err}</p>}
        <button disabled={busy} className={`${btnPrimary} w-full`}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Create account"}</button>
      </form>
      <button onClick={() => { setMode(mode === "in" ? "up" : "in"); setErr(null); }} className="mt-4 text-sm text-neutral-600 underline-offset-2 transition hover:text-neutral-900 hover:underline">
        {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>
    </main>
  );
}
