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

Prossimo step: F2 — app mobile, connessione MWA + swap manuale di prova sul Seeker.
