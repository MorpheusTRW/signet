import type { FastifyInstance } from "fastify";
import type { Env } from "../env.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Privacy policy pubblica (testo sorgente: docs/dapp-store/privacy-policy.md). */
export function registerPrivacyRoute(app: FastifyInstance, env: Env): void {
  if (!env.PRIVACY_CONTROLLER_NAME || !env.PRIVACY_CONTACT_EMAIL) return;
  const controller = escapeHtml(env.PRIVACY_CONTROLLER_NAME);
  const email = escapeHtml(env.PRIVACY_CONTACT_EMAIL);
  const updated = escapeHtml(env.PRIVACY_LAST_UPDATED ?? "");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy — Signet</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#1a1a1a}h1{font-size:1.6em}h2{font-size:1.15em;margin-top:1.6em}</style>
</head><body>
<h1>Privacy Policy — Signet</h1>
${updated ? `<p>Last updated: ${updated}</p>` : ""}
<p>Data controller: ${controller} — <a href="mailto:${email}">${email}</a></p>
<h2>Data we process</h2>
<ul>
<li><strong>Your public wallet address</strong> (never private keys or seed phrases): to determine your plan, your daily signal quota and to send you notifications.</li>
<li><strong>Push notification token</strong> (Firebase Cloud Messaging) and an API key generated for your device: to deliver signals.</li>
<li><strong>App settings</strong> (amount, slippage, kill switch): stored only on your device.</li>
<li><strong>Server technical logs</strong> (wallet address, amount and signal of swap requests, IP address): for security, abuse prevention and diagnostics. Credentials are never logged.</li>
</ul>
<h2>What we don't do</h2>
<p>We never hold funds or keys: every transaction is signed by you in your own wallet. We do not sell your data.</p>
<h2>Third parties</h2>
<p>Firebase (Google) for notifications; Helius and other Solana RPC providers for on-chain data; Jupiter for swap routing; Fly.io for server hosting. They only receive the data needed to provide the service.</p>
<h2>Retention and your rights</h2>
<p>Data linked to your wallet is kept while you use the service. You can request access or deletion by writing to <a href="mailto:${email}">${email}</a>. On-chain transactions are public and immutable by nature.</p>
<h2>Disclaimer</h2>
<p>The service is not intended for minors and is not financial advice.</p>
</body></html>`;

  app.get("/privacy", async (_request, reply) => reply.type("text/html; charset=utf-8").send(html));
}
