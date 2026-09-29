# CLOCK IN — kit di iscrizione e invio (Signet)

Fonte: https://solanamobile.radiant.nexus (letto il 2026-09-29).

- **Invii chiudono: 9 ottobre 2026, 08:59 CEST** (niente consegne in ritardo). Risultati: 10 novembre.
- Iscrizione su **Align**: login → profilo builder → "Clock In Registration". Registrarsi prima possibile (la scadenza di iscrizione è nel calendario dell'evento).
- Da consegnare: **APK funzionante**, **repo GitHub** accessibile ai giudici, **video demo (~3 minuti)**, **pitch deck**.
- Valutazione (25% ciascuno): stickiness/PMF, UX, innovazione, presentazione e demo. I giudici guardano anche la **cronologia dei commit** (profondità tecnica) e l'**uso della rete Solana**.
- Requisiti tecnici: solo Android, **Solana Mobile Stack + Mobile Wallet Adapter**, pensata per mobile, interazione significativa con Solana. ✅ tutti soddisfatti.
- Idoneità: progetto iniziato entro 3 mesi dal lancio (primo commit 23/09/2026 ✅), niente fondi VC/angel per i premi USDC, maggiorenni in paese idoneo, KYC via Sumsub per i vincitori.
- Premio extra **SKR Integration** ($10k in SKR; le sole integrazioni di staking non valgono): Signet usa SKR per il tier Holder (saldo on-chain → segnali in tempo reale e fee più basse).
- I vincitori devono pubblicare sul Solana dApp Store entro 30 giorni.

## Checklist

| # | Cosa | Chi | Stato |
|---|---|---|---|
| 1 | Carta su fly.io/trial — il server deve restare acceso mentre i giudici provano l'APK | tu | ⬜ |
| 2 | Iscrizione su Align + profilo (banner: `docs/hackathon/banner.png`) | tu | ⬜ |
| 3 | Repo GitHub pubblico con codice e README | io | ✅ |
| 4 | Release GitHub v1.0.1 con l'APK firmato | io | ✅ |
| 5 | Video demo (2:58, `signet-demo-3min.mp4` sulla Scrivania) | io | ✅ |
| 6 | Pitch deck (artifact, da scaricare in PDF) | io | ✅ |
| 7 | Invio finale su Align (+ accettazione dei termini) | tu | ⬜ |

## Testi pronti da incollare (inglese)

**Project name:** Signet

**Tagline (≤ 60):** On-chain signals for the Seeker. You sign, in one tap.

**Short description (≤ 280):**
Signet scans every pump.fun → PumpSwap migration on Solana in seconds (bundles, snipers, dev history, holders, liquidity) and pushes a plain-English risk signal to your Seeker. Tap Approve entry: a fresh swap is built, verified on the phone, and signed via Mobile Wallet Adapter.

**Long description:**
Most tokens that graduate from pump.fun are dumped within minutes — in our backtest on 49 real migrations, 82% lost over 80% in about two hours. The warning signs are on-chain at launch (wallets buying in the creation block, burner dev wallets, serial launchers), but nobody can check them fast enough on a phone.

Signet does it for you. A Helius WebSocket watches pump.fun's migration authority; every new PumpSwap pool is parsed from the transaction and scored by unit-tested anti-rug filters calibrated on real migrations. You get a push notification with a risk score and a two-second, plain-English summary — high-risk tokens never ping you.

When you like a signal, tap Approve entry. The server builds an unsigned Jupiter swap at that exact moment (fresh quote and blockhash, never pre-built in the push). Before anything reaches your wallet, the app validates it on the device: fee payer, allow-listed programs, amount cap, no unknown transfers, and the platform fee verified by simulation. Then Mobile Wallet Adapter hands it to the Seed Vault for a biometric signature — Signet never touches a private key.

Paper mode is the default: positions open at the real pool price and follow the live on-chain price, so anyone can practice without risking funds. A per-wallet 20% exposure cap, a one-tap kill switch and an honest, on-chain-measured track record keep it safe and transparent. Holding SKR unlocks the Holder tier with real-time signals and the lowest fees.

**What's new for the hackathon:** the whole app — started on Sept 23, 2026 and built during CLOCK IN.

**How it uses the Solana Mobile Stack:** Mobile Wallet Adapter for connect and signAndSendTransactions (auth token in secure storage), Seed Vault biometric signing through the wallet, built and tested on a physical Seeker, Android-only release APK.

**How it interacts with Solana:** real-time on-chain ingest (Helius WebSocket + RPC), transaction parsing from the pump.fun IDL, on-chain enrichment (authorities, holders, dev history), Jupiter swap building, on-device transaction validation and simulation, real-time pricing from pool vaults, SKR balance check for the Holder tier.

**SKR integration:** holding SKR (checked on-chain) unlocks the Holder tier: real-time signals instead of a 45 s delay, unlimited signals, full history and the lowest platform fee (0.30% vs 0.75%).

**Links:** GitHub https://github.com/MorpheusTRW/signet (pubblico) · APK https://github.com/MorpheusTRW/signet/releases/tag/v1.0.1 · Demo video `<da inserire>` · Privacy https://seeker-signal-engine.fly.dev/privacy

## Note oneste da tenere a mente
- Il track record reale è ripartito da zero il 28/09: nel deck e nel video mostriamo il metodo e i numeri del backtest, non statistiche live che ancora non ci sono.
- Pro (pagamento in USDC/SKR) non è ancora implementato: nel deck va nella roadmap.
- In paper mode nessuna transazione viene firmata: nel video la firma MWA va mostrata con la connessione del wallet (e, se vuoi, con una firma reale in live con una cifra minima).

## Video demo (~3 minuti) — scaletta

Richiesto: "a demo of three minutes", app che gira su un dispositivo vero. Registrazione dallo schermo del Seeker + didascalie (e, se vuoi, la tua voce).

| Tempo | Scena | Cosa si vede |
|---|---|---|
| 0:00–0:10 | Intro | Logo Signet + "On-chain signals. You sign, in one tap." |
| 0:10–0:25 | Problema | "82% of graduated tokens lost 80%+ in ~2h" (backtest) |
| 0:25–0:45 | Connessione | Schermata di benvenuto → Connect wallet → MWA / Seed Vault |
| 0:45–1:10 | Push + feed | Notifica di un segnale → tap → feed con loghi e rischio |
| 1:10–1:40 | Rischio | Dettaglio: punteggio, bundle, dev usa e getta; "Open on pump.fun" |
| 1:40–2:10 | Approve | Importo → Approve entry → fee/slippage/impact → Verify → posizione aperta |
| 2:10–2:30 | Positions | PnL al prezzo reale, Close position |
| 2:30–2:45 | Controllo | Kill switch, limite 20%, piani (Holder con SKR) |
| 2:45–3:00 | Chiusura | Architettura in una frase + logo + "Paper mode · Not financial advice" |
