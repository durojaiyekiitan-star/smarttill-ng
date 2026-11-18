"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { btnSecondary } from "./ui";

export function PrintButton() {
  return <button onClick={() => window.print()} className={`${btnSecondary} print:hidden`}>Print receipt</button>;
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className={btnSecondary}
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push("/login");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}
