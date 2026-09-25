# Pubblicazione su Solana dApp Store

Fonti (verificate 2026-09-25): docs.solanamobile.com (`dapp-store/submit-new-app`,
`dapp-store/publishing-cli`, `dapp-store/listing-page-guidelines`) e Publisher Policy
(legal.solanamobile.com/publisher-policy-web). Il flusso è cambiato: il vecchio
`config.yaml` + `dapp-store init/create` non è più il percorso attivo, ora si passa dal
**Publisher Portal** (https://publish.solanamobile.com).

## Prima di buildare (bloccanti)

1. **Engine pubblico in HTTPS.** `EXPO_PUBLIC_ENGINE_API_URL` viene incorporato nell'APK al momento
   della build e Android release blocca l'HTTP in chiaro. `scripts/check-release-env.mjs` rifiuta
   URL non-https o locali. Serve quindi un deploy dell'engine (VM/container con volume persistente
   per SQLite, `.env` di produzione, dominio + TLS). Non incluso in F5.
2. **RPC dedicato** (`EXPO_PUBLIC_SOLANA_RPC_URL` e `SOLANA_RPC_URL`): il pubblico è rate-limited.
3. **Privacy policy pubblicata a un URL** (bozza: `privacy-policy.md`). La Publisher Policy
   ("Guidelines for User Data") la richiede.
4. **Chiave di firma release** in `~/.seeker-signal/release.jks` + `apps/mobile/keystore.properties`.
   **Fanne un backup ora** (password manager / disco cifrato): l'identità dell'app sullo store è
   legata a questa chiave e, se la perdi, non potrai più pubblicare aggiornamenti.
5. Decidi `TRADING_MODE` dell'engine di produzione. Con `paper` (default) gli utenti vedono solo
   simulazioni: dichiaralo nella scheda, altrimenti è un contenuto fuorviante (Publisher Policy,
   "Deliberately Misleading Content").
6. Servizi finanziari regolati: la policy richiede la documentazione prevista dalla legge applicabile
   ("Restricted Activities and Transactions"). Un'app che instrada swap con fee può rientrarvi:
   valutalo con un consulente legale prima della submission.

## Build

```bash
cd apps/mobile
EXPO_PUBLIC_ENGINE_API_URL=https://<tuo-engine> pnpm android:release
# APK: apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

Il preflight blocca la build se manca `keystore.properties` o se l'URL non è https. La build release
non ricade mai sulla chiave di debug (il plugin `plugins/with-release-signing.js` fa fallire Gradle).
Per ogni nuova versione incrementa `expo.android.versionCode` (e `version`) in `app.json`.

Verifica la firma: `apksigner verify --print-certs app-release.apk` (build-tools dell'Android SDK)
deve mostrare il certificato `CN=Seeker Signal`, non "Android Debug".

## Publisher Portal (passi manuali: KYC e wallet sono tuoi)

1. Crea l'account publisher su https://publish.solanamobile.com e completa KYC/KYB.
2. Collega il wallet publisher (permanente: perdere l'accesso blocca le submission future) con circa
   **0,2 SOL** per fee e caricamento su ArDrive (la doc consiglia ArDrive; il portale stima il costo).
3. "Add a dApp" → "New dApp": compila la scheda con i testi di `LISTING.md` e gli asset richiesti
   (icona 512×512 in `assets/icon-512.png`; screenshot ≥1080px, stesso orientamento e rapporto).
4. "New Version" → carica l'APK release firmato → approva tutte le richieste di firma (upload Arweave
   e mint degli NFT). Tutte vanno approvate.
5. Revisione: 3–5 giorni lavorativi; per aggiornamenti successivi si può usare la CLI
   (`npm i -g @solana-mobile/dapp-store-cli`; `dapp-store --apk-file … --keypair … --whats-new "…"`,
   con `DAPP_STORE_API_KEY` generata in Settings → API keys del portale).
6. Prepara un wallet di test con accesso completo per il reviewer se servono funzioni gated.
