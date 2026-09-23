# Progress

## F0 — Scaffold monorepo + package shared

- Creato monorepo pnpm workspaces: `apps/mobile` (vuoto, in attesa di F2), `services/engine`, `packages/shared`.
- `packages/shared`: schemi zod + tipi per `Signal`, `RiskReport`, `SwapRequest` (validazione forma/campi; nessuna logica di business).
- `services/engine`: scaffold Fastify + TypeScript strict, caricamento env con zod (`src/env.ts`), bootstrap server con un solo endpoint `/health` per verifica smoke. Nessuna logica di ingest/filtri/API di dominio ancora.
- Root: `pnpm-workspace.yaml`, `tsconfig.base.json` condiviso (strict, no `any` implicito), script `dev` / `test` / `typecheck` alla root, `.env.example`.
- Stato: typecheck pulito, test verdi (smoke test su `/health` e sugli schemi zod).

## F1 — Engine in synthetic mode: filtri, segnali, API, paper trading

- **Program ID reali** verificati sulla doc ufficiale (Meteora DBC/DAMM v2 da fonte primaria; pump.fun/PumpSwap/Raydium LaunchLab da più fonti indipendenti coerenti) in `src/config/programs.ts`, con note sulle fonti e avviso di ri-verifica prima dell'uso on-chain in F5.
- **Ingest**: interfaccia `EventSource` (`src/ingest/event-source.ts`) + adapter `SyntheticEventSource` che genera lanci sintetici realistici con tre archetipi (clean/medium/rug, inclusi rug evidenti) per esercitare i filtri. Generatore puro e deterministico rispetto a un rng iniettabile (`src/ingest/synthetic/`).
- **Filtri** (funzioni pure, `src/filters/`): concentrazione top 10 holder, storico dev wallet, liquidità iniziale, snipe nei primi blocchi, mint/freeze authority. Aggregati in `computeRiskReport` → `RiskReport` (score 0-100, livello low/medium/high, motivi).
- **Sintesi** deterministica da template (`src/signals/summarize.ts`), nessun LLM nel percorso critico.
- **Persistenza SQLite** (better-sqlite3, `src/db/`): tabelle `signals`, `devices`, `paper_trades`. Endpoint `GET /signals`, `GET /signals/:id`, `POST /devices` (genera e restituisce un'API key per device; solo l'hash è salvato).
- **Paper trading** (`src/paper-trading/`): ogni segnale approvabile (rischio non "high") apre una posizione simulata con size limitata dal 20% di esposizione massima del portafoglio (principio 3 di CLAUDE.md), verificato lato server sommando le posizioni ancora aperte. Le posizioni restano "open" per una durata simulata prima di chiudersi e realizzare il PnL, così il limite ha un effetto reale fra segnali concorrenti nel tempo.
- Verificato manualmente end-to-end con `pnpm dev`: eventi sintetici generati, filtrati, sintetizzati, salvati, esposti su `/signals` e `/signals/:id`; `/devices` registra un device con API key in chiaro restituita una sola volta; `paper_trades` popolata con PnL simulato entro il limite di esposizione.
- Stato: typecheck pulito, 55 test verdi (filtri, generatore sintetico, summary, build-signal, paper trading, pipeline, route HTTP, health).

## Monetizzazione — backend (tier, entitlements, track record)

- Aggiunta sezione "Monetizzazione" a `CLAUDE.md` (tier FREE/PRO/HOLDER, fee per tier, pagamento on-chain, soglie in config).
- **SKR — verifica doc ufficiale Solana Mobile** (`src/config/skr.ts`, verificato 2026-09-23):
  - Mint: `SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3` (fonte primaria: `docs.solanamobile.com/solana-mobile-stack/skr.md`).
  - **Lo stake È leggibile on-chain**: Staking Program `SKRskrmtL83pcL4YqLWt6iPefDqwXQWHSw9S9vz94BZ` (confermato anche dal post ufficiale @solanamobile su X), Stake Config `4HQy82s9CHTv1GsYKnANHMiHfhcqesYkK6sB3RDSYyqw`. Layout account (`UserStake`, `StakeConfig`) e seed della PDA presi dall'IDL Anchor pubblico nel sample ufficiale `solana-mobile/react-native-samples/skr-staking`. La doc non espone un client pronto (il sample lo genera via Codama dall'IDL): in `src/entitlements/skr-holder.ts` decodifichiamo a mano i campi necessari (`shares`, `share_price`) via `getProgramAccounts` + memcmp, seguendo esattamente gli offset dell'IDL — quindi il tier HOLDER considera **saldo SKR + stake SKR**, non solo il saldo.
  - Senza `SOLANA_RPC_URL` configurato (default in sviluppo/synthetic mode) la verifica HOLDER degrada a "mai holder" (fail-closed) invece di inventare un dato; loggato via `NULL_SKR_HOLDER_READER`.
- **Entitlements** (`src/entitlements/`): `resolveTier` calcola FREE/PRO/HOLDER per wallet — HOLDER (SKR live, cache 10 min) vince su un abbonamento PRO a pagamento, poi PRO attivo (`subscriptions`), altrimenti FREE. Limiti e fee per tier (`getTierLimits`) letti solo da config/env, mai hardcoded.
- **`GET /me/tier?pubkey=...`**: tier attuale, scadenza abbonamento (se PRO), limiti applicabili.
- **Distribuzione segnali tier-aware** (`GET /signals?pubkey=...`): FREE vede i segnali con ritardo (`FREE_SIGNAL_DELAY_SECONDS`), storico limitato (`FREE_HISTORY_HOURS`) e un tetto giornaliero di nuovi segnali (`FREE_MAX_SIGNALS_PER_DAY`, tracciato per wallet in `signal_deliveries`); PRO/HOLDER in tempo reale, storico completo, nessun tetto. `GET /signals` senza `pubkey` resta il feed grezzo non filtrato (compatibilità con F1, uso interno).
- **Tabella `subscriptions`** (wallet, tier, expiresAt, paymentSignature): schema e repo pronti; **la verifica del pagamento on-chain (USDC/SKR → treasury) non è implementata in questa iterazione** — non richiesta esplicitamente nello scope, da affrontare come step dedicato prima di un vero flusso di acquisto PRO.
- **Track record filtri** (`src/track-record/`, tabella `track_records`): ogni segnale processato viene classificato `discarded` (rischio "high", filtrato) o `signaled` (basso/medio, mostrato); a +1h e +24h la variazione di prezzo viene "realizzata" (lazy settle, stesso pattern dei paper trade). In synthetic mode l'esito è generato in modo deterministico e realistico: i `discarded` crollano quasi sempre (~75% oltre -90% a 24h, sempre negativi), i `signaled` hanno un esito bilanciato. `GET /track-record` aggrega (totali, media, mediana, conteggio crolli ≥90% e raddoppi, per finestra 1h/24h e categoria).
- Fee piattaforma sugli swap (`platformFeeBps` per tier, es. FREE 75 / PRO 50 / HOLDER 30 bps) sono nei limiti restituiti da `/me/tier`; l'incasso via meccanismo di platform fee di Jupiter e la visualizzazione obbligatoria della fee prima della firma sono compito di `/build-swap` (F4) e dell'app mobile — non ancora implementati.
- Verificato manualmente end-to-end con `pnpm dev`: `/me/tier` risolve FREE di default (nessun RPC configurato), `/signals?pubkey=...` nasconde i segnali entro il delay e li mostra dopo, `/track-record` popola `signaled`/`discarded` man mano che il pipeline sintetico gira.
- Stato: typecheck pulito, 114 test verdi in totale (59 nuovi: tier/limiti, resolve-tier, distribuzione segnali, cache TTL, holder-check, decodifica SKR pura, generatore esiti sintetici, settle track record, aggregazione statistiche, route `/me/tier`, `/track-record`, `/signals` tier-aware).

Prossimo step: F2 — app mobile, connessione MWA + swap manuale di prova sul Seeker (oppure, se prioritario, il flusso di verifica pagamento on-chain per l'abbonamento PRO).
