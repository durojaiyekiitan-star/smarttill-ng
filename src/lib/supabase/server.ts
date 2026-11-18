import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Per-request client that acts as the logged-in user, so row level security applies. */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Called from a Server Component: cookies are refreshed by the browser client instead.
        }
      },
    },
  });
}

export async function getUser() {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user;
}
