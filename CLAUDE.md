# Seeker Signal — screener mobile-first con esecuzione biometrica

dApp per Solana Seeker. Un backend analizza i nuovi token on-chain e invia segnali push.
L'utente approva l'entry dal telefono e firma con biometria tramite Mobile Wallet Adapter (MWA) + Seed Vault.
L'app non gestisce mai chiavi private.

## Principi non negoziabili

1. **Mai transazioni pre-costruite nella push.** La push porta solo il segnale. La transazione viene costruita FRESCA al tap su "Approva Entry" (blockhash e quote aggiornati).
2. **L'app valida ogni transazione prima di passarla a MWA**: fee payer = wallet utente, solo program ID in allowlist, importo in SOL ≤ size approvata dall'utente, nessun transfer verso indirizzi sconosciuti. Se la validazione fallisce, non firmare.
3. **Limite di esposizione**: mai più del 20% del valore totale del portafoglio in posizioni aperte. Applicato lato server E ricontrollato lato app.
4. **Paper mode di default.** Il live trading si attiva solo con flag esplicito (`TRADING_MODE=live`).
5. **Verifica sempre la documentazione corrente** di Solana Mobile, Jupiter, pump.fun/PumpSwap, Helius e Firebase prima di usare un'API: cambiano spesso. Non inventare endpoint o firme di funzione.

## Struttura monorepo (pnpm workspaces, TypeScript ovunque)

```
seeker-signal/
├─ apps/mobile/         # Expo (development build, solo Android)
├─ services/engine/     # Node.js: ingest on-chain, filtri, segnali, API, push
├─ packages/shared/     # tipi condivisi (Signal, RiskReport, SwapRequest) + validazione tx
└─ CLAUDE.md
```

## services/engine

- Runtime: Node 20+, Fastify, zod per validare input/env, pino per i log.
- **Ingest** dietro un'interfaccia `EventSource` con adapter intercambiabili:
  - `synthetic` — genera lanci finti realistici (default, per sviluppo)
  - `helius-ws` — WebSocket `logsSubscribe` sui program monitorati
  - `yellowstone-grpc` — stream gRPC (quando disponibile un endpoint)
- Program monitorati: pump.fun (create + migrazione), PumpSwap, Meteora (DBC/DAMM), Raydium LaunchLab. Program ID in un file di config, verificati sulla doc ufficiale.
- **Filtri** (funzioni pure, testate con vitest): % supply top 10 holder, storico dev wallet, liquidità iniziale, snipe nei primi blocchi, mint/freeze authority revocate. Output: `RiskReport` con punteggio e motivi.
- **Sintesi**: stringa deterministica da template (es. `Nuova pool Meteora. Dev pulito. Snipe di 3 wallet. Rischio: Basso.`). Niente LLM nel percorso critico.
- **API**:
  - `GET /signals` e `GET /signals/:id`
  - `POST /devices` — registra token FCM + pubkey wallet
  - `POST /build-swap` — input: signalId, pubkey, amountSol, slippageBps → restituisce tx NON firmata (base64) costruita al momento. Controlla il limite del 20% prima di costruire.
- **Swap**: Jupiter Swap API come prima scelta, con priority fee. Verifica se Jupiter instrada i token ancora in bonding curve pump.fun; se no, adapter dedicato.
- **Push**: firebase-admin, messaggio con notifica visibile + dati (`signalId`, summary, risk). Payload leggero.
- Persistenza: SQLite (better-sqlite3) per segnali, device e trade di paper mode.
- Auth API: API key per device, registrata alla prima apertura.

## Monetizzazione

Tre livelli di accesso (tier), calcolati lato server per ogni wallet:
- FREE: segnali con ritardo configurabile (default 45s), max N segnali/giorno,
  solo filtri base, storico ultime 24h.
- PRO (abbonamento 30 giorni): segnali in tempo reale, filtri personalizzati,
  storico completo. Pagabile in USDC o SKR con trasferimento on-chain alla treasury.
- HOLDER: chi detiene o ha in stake almeno X SKR ottiene PRO gratis.
Fee sugli swap: platformFeeBps configurabile per tier (es. FREE 75, PRO 50,
HOLDER 30), incassata tramite il meccanismo di platform fee di Jupiter.
La fee deve essere sempre mostrata all'utente prima della firma.
Tutti i prezzi, le soglie e le bps stanno in config, non nel codice.

## apps/mobile

- Partire dal template Expo ufficiale di Solana Mobile. Development build (`expo run:android`), NON Expo Go.
- Librerie: `@solana-mobile/mobile-wallet-adapter-protocol-web3js`, `@solana/web3.js`, polyfill richiesti (crypto random values, Buffer) come da doc Solana Mobile.
- Navigazione: expo-router. Schermate: Feed segnali, Dettaglio segnale (con "Approva Entry"), Posizioni, Impostazioni (size default, slippage, kill switch).
- MWA: `transact()` → `authorize` / `reauthorize` con `auth_token` salvato in modo sicuro (expo-secure-store) → `signAndSendTransactions`.
- La biometria la gestisce il wallet con Seed Vault, non l'app.
- Push: FCM, tap sulla notifica → deep link a `/signal/[id]`.
- UI: dark, minimale, testo grande, un'azione per schermata. Il segnale deve essere leggibile in 2 secondi.

## Convenzioni

- TypeScript strict, niente `any`.
- Ogni fase termina con: typecheck pulito, test verdi, breve nota in `PROGRESS.md`.
- Segreti solo in `.env` (mai committati); fornire `.env.example`.
- Commit piccoli, un commit per sotto-step.

## Fasi

- **F0** Scaffold monorepo + package shared
- **F1** Engine in synthetic mode: filtri, segnali, API, paper trading
- **F2** App mobile: connessione MWA + swap manuale di prova sul Seeker
- **F3** Push FCM + deep link al segnale
- **F4** `/build-swap` + validazione tx + firma biometrica + conferma
- **F5** Hardening: kill switch, limiti, logging, adapter on-chain reale, build per Solana dApp Store
