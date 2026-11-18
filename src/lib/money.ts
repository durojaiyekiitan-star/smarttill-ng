// All amounts are integers in minor units (BigInt), paired with an asset scale.
// Example: value "1000" with scale 2 means 10.00.

export function formatMinor(value: bigint | string, scale: number): string {
  const v = BigInt(value);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const base = 10n ** BigInt(scale);
  const whole = (abs / base).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = scale > 0 ? "." + (abs % base).toString().padStart(scale, "0") : "";
  return `${neg ? "-" : ""}${whole}${frac}`;
}

/** Illustrative only. Testnet assets are NOT Naira. Always label the result as illustrative. */
export function illustrativeNgn(value: bigint | string, scale: number, ngnPerUnit: number): string {
  const units = Number(BigInt(value)) / 10 ** scale;
  return "₦" + Math.round(units * ngnPerUnit).toLocaleString("en-NG");
}

export function ngnPerUnit(): number {
  const r = Number(process.env.ILLUSTRATIVE_NGN_PER_UNIT);
  return Number.isFinite(r) && r > 0 ? r : 1500;
}
