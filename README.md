# Signet

**On-chain signals for the Solana Seeker. You sign, in one tap.**

Signet watches every pump.fun → PumpSwap migration on Solana, runs it through anti-rug filters in seconds and pushes a plain-English signal to your Seeker. If you like it, you tap **Approve entry**: the app builds a fresh swap at that moment, checks it on the phone, and asks your wallet to sign through Mobile Wallet Adapter. Keys never leave the Seed Vault.

> Built for CLOCK IN — the Solana Mobile hackathon. Android only, designed for the Seeker from the ground up.

| Signals | Risk | Approve | Positions |
|---|---|---|---|
| Live feed of new pools with token logos, risk pills and a 2-second summary | Bundles, snipers, dev history, holders, liquidity → one score | Fresh Jupiter swap, fee shown up front, validated before signing | Paper positions tracked at real on-chain prices |

## Why

Most tokens that "graduate" on pump.fun are dumped within minutes. In a backtest on 49 real migrations, **82% lost more than 80% within ~2 hours**. The patterns are visible on-chain at launch — wallets buying in the same block as the creation (bundles), burner dev wallets funded seconds before, serial launchers — but nobody checks them fast enough on a phone. Signet does, and then gets out of the way: you decide, you sign.

## What it does

- **Real-time ingest** — Helius WebSocket on pump.fun's migration authority; every new PumpSwap pool is parsed from the transaction itself (official pump.fun IDL).
- **Anti-rug filters** — pure, unit-tested functions: bundle % in the launch block, linked wallets (shared fee payers), dev buy %, burner dev wallet, serial launcher history, time-to-migration, abnormal migrations, top-holder concentration, mint/freeze authority. Calibrated on real migrations (`services/engine/scripts/backtest-migrations.ts`).
- **Plain-English summary** — deterministic template, no LLM in the critical path: *"New PumpSwap pool. Bundle 24% at launch. Dev: at least 26 launches, 1 migrated. Risk: High."*
- **Push notifications (FCM)** — tier-aware; high-risk signals never ping you. Tap → deep link to the signal.
- **Approve entry** — `POST /build-swap` builds an unsigned Jupiter swap *at tap time* (fresh blockhash and quote, never pre-built in the push). The app validates it locally before handing it to MWA: fee payer = your wallet, allow-listed programs only, amount ≤ what you approved, no transfers to unknown addresses, platform fee verified by simulation.
- **Paper mode by default** — positions open at the real pool price (constant-product fill on live reserves, fees included) and follow the real price; you close them. Live trading requires an explicit server flag.
- **Safety** — per-wallet 20% exposure cap (server-side and re-checked on the phone), kill switch (on the phone and server-wide), max size per trade, rate limits.
- **SKR integration** — holding SKR unlocks the **Holder** tier: real-time signals and the lowest swap fee, checked on-chain.
- **Honest track record** — every signal is priced from its pool at launch and again after 1h and 24h. Late or unreadable marks are discarded, never faked; stats appear only after enough samples.

## Solana Mobile Stack

- **Mobile Wallet Adapter** (`@wallet-ui/react-native-web3js`) for connect and `signAndSendTransactions`; the auth token is stored in `expo-secure-store`.
- **Seed Vault** biometrics via the wallet — Signet never sees a private key.
- Built and tested on a physical Solana Seeker (Expo development build, Android only).

## Architecture

```
apps/mobile        Expo / React Native app (Android): feed, detail, approve, positions, track record, plans, settings
services/engine    Node + Fastify + SQLite: Helius ingest, filters, signals API, /build-swap, push, paper positions, track record
packages/shared    Shared types (zod) + validateSwapTx, used by both the app and the engine
```

The engine runs on Fly.io; the app talks to it over HTTPS. Prices come straight from on-chain pool vaults (no third-party price API).

## Run it

Requirements: Node 20.12+, pnpm 9, JDK 17, Android SDK, an Android device with a Solana wallet (e.g. the Seeker's).

```bash
pnpm install
cp .env.example .env                     # engine config: HELIUS_API_KEY, SOLANA_RPC_URL, TREASURY_WALLET_PUBKEY, FIREBASE_* (optional)
pnpm dev                                 # engine on :3000 (EVENT_SOURCE=synthetic works with no keys)
pnpm test                                # 190+ unit tests (engine + shared)

cd apps/mobile
cp .env.example .env                     # EXPO_PUBLIC_ENGINE_API_URL=http://<your-lan-ip>:3000
pnpm android                             # development build on a connected device
```

Push notifications need your own `apps/mobile/google-services.json` (Firebase). A prebuilt release APK is attached to the GitHub release.

## Status

- ✅ Real on-chain ingest, filters, signals, push, swap building and validation, paper positions at real prices, real track record
- ✅ Runs on a physical Seeker
- 🔜 Pro subscription payments (USDC/SKR), live trading rollout, Solana dApp Store listing

**Not financial advice.** Signals are automated and can be wrong; new tokens are extremely risky.
