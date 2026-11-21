import { createAuthenticatedClient } from "@interledger/open-payments";
import { createPrivateKey } from "node:crypto";
import { readFileSync } from "node:fs";
import { must } from "../env";
import { normalizeWalletUrl } from "../wallet-input";

type Client = Awaited<ReturnType<typeof createAuthenticatedClient>>;
let cached: Promise<Client> | null = null;

export { normalizeWalletUrl };

function loadPrivateKey() {
  let text: string;
  if (process.env.MAIN_TILL_PRIVATE_KEY_B64) {
    // Hosted (Vercel): the key file content, base64-encoded, lives in an environment variable.
    text = Buffer.from(process.env.MAIN_TILL_PRIVATE_KEY_B64, "base64").toString("utf8");
  } else if (process.env.MAIN_TILL_PRIVATE_KEY_PATH) {
    text = readFileSync(process.env.MAIN_TILL_PRIVATE_KEY_PATH, "utf8");
  } else {
    throw new Error("Set MAIN_TILL_PRIVATE_KEY_PATH (local) or MAIN_TILL_PRIVATE_KEY_B64 (Vercel)");
  }
  text = text.trim();
  const pem = text.includes("BEGIN") ? text : Buffer.from(text, "base64").toString("utf8");
  return createPrivateKey(pem);
}

/** The app acts as a client identified by the Main Till wallet key. Server-side only. */
export function getClient(): Promise<Client> {
  if (!cached) {
    cached = createAuthenticatedClient({
      walletAddressUrl: normalizeWalletUrl(must("MAIN_TILL_WALLET_URL")),
      keyId: must("MAIN_TILL_KEY_ID"),
      privateKey: loadPrivateKey(),
    }).catch((e) => {
      cached = null;
      throw e;
    });
  }
  return cached;
}

export async function getWallet(url: string) {
  const client = await getClient();
  return client.walletAddress.get({ url: normalizeWalletUrl(url) });
}
