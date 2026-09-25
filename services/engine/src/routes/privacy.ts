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
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Privacy Policy — Seeker Signal</title>
<style>body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#1a1a1a}h1{font-size:1.6em}h2{font-size:1.15em;margin-top:1.6em}</style>
</head><body>
<h1>Privacy Policy — Seeker Signal</h1>
${updated ? `<p>Ultimo aggiornamento: ${updated}</p>` : ""}
<p>Titolare del trattamento: ${controller} — <a href="mailto:${email}">${email}</a></p>
<h2>Dati che trattiamo</h2>
<ul>
<li><strong>Indirizzo pubblico del wallet</strong> (mai chiavi private né seed phrase): per calcolare il tuo piano, la quota giornaliera di segnali e inviarti notifiche.</li>
<li><strong>Token di notifica push</strong> (Firebase Cloud Messaging) e una chiave API generata per il tuo dispositivo: per inviarti i segnali.</li>
<li><strong>Impostazioni dell'app</strong> (importo, slippage, kill switch): salvate solo sul tuo dispositivo.</li>
<li><strong>Log tecnici del server</strong> (indirizzo wallet, importo e segnale delle richieste di swap, indirizzo IP): per sicurezza, prevenzione degli abusi e diagnostica. Le credenziali non vengono registrate.</li>
</ul>
<h2>Cosa non facciamo</h2>
<p>Non custodiamo fondi né chiavi: ogni transazione è firmata da te nel tuo wallet. Non vendiamo i tuoi dati.</p>
<h2>Terze parti</h2>
<p>Firebase (Google) per le notifiche; Helius e altri provider RPC Solana per i dati on-chain; Jupiter per l'instradamento degli swap; Fly.io per l'hosting del server. Ricevono solo i dati necessari a fornire il servizio.</p>
<h2>Conservazione e diritti</h2>
<p>I dati associati al tuo wallet sono conservati finché usi il servizio. Puoi chiederne l'accesso o la cancellazione scrivendo a <a href="mailto:${email}">${email}</a>. Le transazioni on-chain sono pubbliche e non modificabili per loro natura.</p>
<h2>Avvertenze</h2>
<p>Il servizio non è rivolto ai minori e non costituisce consulenza finanziaria.</p>
</body></html>`;

  app.get("/privacy", async (_request, reply) => reply.type("text/html; charset=utf-8").send(html));
}
