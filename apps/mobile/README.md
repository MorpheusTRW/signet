# Seeker Signal — mobile

App Expo (development build, solo Android) per Solana Seeker. Vedi il `CLAUDE.md` alla radice del monorepo per l'architettura completa e `PROGRESS.md` per lo stato di avanzamento.

## Setup

```bash
cp .env.example .env
# imposta EXPO_PUBLIC_ENGINE_API_URL sull'IP raggiungibile da dispositivo/emulatore
```

Da root del monorepo:

```bash
pnpm install
```

## Sviluppo

```bash
cd apps/mobile
pnpm android          # build + installa il development build su device/emulatore Android
pnpm start            # riavvia il bundler Metro (dopo il primo build)
```

Richiede `services/engine` in esecuzione e raggiungibile (`pnpm dev` dalla root, o `pnpm --filter @seeker-signal/engine dev`).

## Verifica ambiente Android

```bash
npx -y solana-mobile@latest doctor
```
