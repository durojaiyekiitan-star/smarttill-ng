import {
  createAuthenticatedClient,
  isPendingGrant,
} from "@interledger/open-payments";
import { readFileSync } from "node:fs";
import { createPrivateKey, randomUUID } from "node:crypto";
import http from "node:http";

const env = process.env;

function loadKey(path) {
  const text = readFileSync(path, "utf8").trim();
  // Accept a normal PEM file, or a base64-encoded PEM
  const pem = text.includes("BEGIN")
    ? text
    : Buffer.from(text, "base64").toString("utf8");
  return createPrivateKey(pem);
}

function waitForInteractRef() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, "http://localhost:3344");
      const ref = url.searchParams.get("interact_ref");
      res.end("Approved. You can close this tab and return to the terminal.");
      if (ref) resolve(ref);
    });
    server.listen(3344);
  });
}

const client = await createAuthenticatedClient({
  walletAddressUrl: env.MAIN_TILL_WALLET_URL,
  keyId: env.MAIN_TILL_KEY_ID,
  privateKey: loadKey(env.MAIN_TILL_PRIVATE_KEY_PATH),
});

// 1. Look up both wallets
const sender = await client.walletAddress.get({ url: env.MAIN_TILL_WALLET_URL });
const receiver = await client.walletAddress.get({ url: env.RESERVE_WALLET_URL });
console.log("Sender asset:", sender.assetCode, sender.assetScale);
console.log("Receiver asset:", receiver.assetCode, receiver.assetScale);

// 2. Grant + incoming payment on the receiver (1.00 of the receiver's asset)
const ipGrant = await client.grant.request(
  { url: receiver.authServer },
  {
    access_token: {
      access: [
        { type: "incoming-payment", actions: ["create", "read", "complete"] },
      ],
    },
  }
);
if (isPendingGrant(ipGrant)) throw new Error("Unexpected interactive grant");

const incomingPayment = await client.incomingPayment.create(
  { url: receiver.resourceServer, accessToken: ipGrant.access_token.value },
  {
    walletAddress: receiver.id,
    incomingAmount: {
      value: String(10 ** receiver.assetScale),
      assetCode: receiver.assetCode,
      assetScale: receiver.assetScale,
    },
    metadata: { description: "SmartTill spike test" },
  }
);
console.log("Incoming payment:", incomingPayment.id);

// 3. Grant + quote on the sender
const quoteGrant = await client.grant.request(
  { url: sender.authServer },
  { access_token: { access: [{ type: "quote", actions: ["create", "read"] }] } }
);
if (isPendingGrant(quoteGrant)) throw new Error("Unexpected interactive grant");

const quote = await client.quote.create(
  { url: sender.resourceServer, accessToken: quoteGrant.access_token.value },
  { method: "ilp", walletAddress: sender.id, receiver: incomingPayment.id }
);
console.log("Quote debit amount:", quote.debitAmount);

// 4. Interactive outgoing-payment grant (needs YOUR approval in the browser)
const opGrant = await client.grant.request(
  { url: sender.authServer },
  {
    access_token: {
      access: [
        {
          type: "outgoing-payment",
          actions: ["create", "read"],
          identifier: sender.id,
          limits: { debitAmount: quote.debitAmount },
        },
      ],
    },
    interact: {
      start: ["redirect"],
      finish: {
        method: "redirect",
        uri: "http://localhost:3344",
        nonce: randomUUID(),
      },
    },
  }
);
if (!isPendingGrant(opGrant)) throw new Error("Expected interactive grant");

const refPromise = waitForInteractRef();
console.log("\nOPEN THIS URL IN YOUR BROWSER AND APPROVE:\n" + opGrant.interact.redirect + "\n");
const interactRef = await refPromise;

// 5. Finish the grant, then create the outgoing payment
const finalGrant = await client.grant.continue(
  {
    url: opGrant.continue.uri,
    accessToken: opGrant.continue.access_token.value,
  },
  { interact_ref: interactRef }
);

const outgoingPayment = await client.outgoingPayment.create(
  { url: sender.resourceServer, accessToken: finalGrant.access_token.value },
  { walletAddress: sender.id, quoteId: quote.id }
);
console.log("Outgoing payment created:", outgoingPayment.id);

// 6. Verify: read both payments back instead of trusting the create call
const opCheck = await client.outgoingPayment.get({
  url: outgoingPayment.id,
  accessToken: finalGrant.access_token.value,
});
console.log("Outgoing payment state:", JSON.stringify(opCheck, null, 2));

const ipCheck = await client.incomingPayment.get({
  url: incomingPayment.id,
  accessToken: ipGrant.access_token.value,
});
console.log("Incoming payment state:", JSON.stringify(ipCheck, null, 2));

process.exit(0);