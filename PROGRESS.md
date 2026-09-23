# Progress

## F0 — Scaffold monorepo + package shared

- Creato monorepo pnpm workspaces: `apps/mobile` (vuoto, in attesa di F2), `services/engine`, `packages/shared`.
- `packages/shared`: schemi zod + tipi per `Signal`, `RiskReport`, `SwapRequest` (validazione forma/campi; nessuna logica di business).
- `services/engine`: scaffold Fastify + TypeScript strict, caricamento env con zod (`src/env.ts`), bootstrap server con un solo endpoint `/health` per verifica smoke. Nessuna logica di ingest/filtri/API di dominio ancora.
- Root: `pnpm-workspace.yaml`, `tsconfig.base.json` condiviso (strict, no `any` implicito), script `dev` / `test` / `typecheck` alla root, `.env.example`.
- Stato: typecheck pulito, test verdi (smoke test su `/health` e sugli schemi zod).

Prossimo step: F1 — engine in synthetic mode (filtri, segnali, API, paper trading).
