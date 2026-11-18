export type AppMode = "testnet" | "demo";

/** Central mode switch. Set APP_MODE=demo for simulated data; anything else means real testnet. */
export function appMode(): AppMode {
  return process.env.APP_MODE === "demo" ? "demo" : "testnet";
}

export function must(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export function walletUrlsFromEnv(): { role: "main" | "reserve" | "owner"; url: string }[] {
  const pairs: ["main" | "reserve" | "owner", string][] = [
    ["main", "MAIN_TILL_WALLET_URL"],
    ["reserve", "RESERVE_WALLET_URL"],
    ["owner", "OWNER_WALLET_URL"],
  ];
  return pairs.flatMap(([role, name]) => (process.env[name] ? [{ role, url: process.env[name]! }] : []));
}

export function startOfLagosDayIso(): string {
  const lagosNow = new Date(Date.now() + 3600_000); // Lagos is UTC+1, no DST
  lagosNow.setUTCHours(0, 0, 0, 0);
  return new Date(lagosNow.getTime() - 3600_000).toISOString();
}
