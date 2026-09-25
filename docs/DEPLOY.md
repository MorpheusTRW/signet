# Deploy dell'engine su Fly.io

Costo atteso: ~6–8 $/mese (macchina shared-cpu-1x 1 GB + volume 1 GB). Nessun dominio necessario
all'inizio: Fly fornisce `https://<app>.fly.dev` con HTTPS incluso.

## Una tantum (passi tuoi: account e pagamento)

```bash
brew install flyctl
fly auth signup        # oppure `fly auth login` se hai già un account; serve una carta
```

## Primo deploy (dalla radice del repo)

```bash
fly apps create seeker-signal-engine          # se il nome è preso, scegline un altro e aggiorna fly.toml
fly volumes create engine_data --region ams --size 1 --app seeker-signal-engine
node scripts/fly-secrets.mjs --app seeker-signal-engine
fly deploy --ha=false
```

- `--ha=false`: una sola macchina. SQLite sta sul volume, che non è condivisibile fra macchine.
- `scripts/fly-secrets.mjs` legge i segreti dal `.env` locale (Firebase, Helius, treasury, admin,
  privacy) e li registra su Fly senza stamparli. In produzione `SOLANA_RPC_URL` diventa l'RPC Helius.
- Il build dell'immagine avviene sui builder remoti di Fly: non serve Docker sul Mac.

## Verifica

```bash
curl https://seeker-signal-engine.fly.dev/health      # {"status":"ok"}
curl https://seeker-signal-engine.fly.dev/status      # killSwitch/tradingMode
fly logs --app seeker-signal-engine                   # cerca "helius-ws connesso"
```

## App collegata all'engine pubblico

```bash
cd apps/mobile
EXPO_PUBLIC_ENGINE_API_URL=https://seeker-signal-engine.fly.dev pnpm android:release
adb uninstall com.seekersignal.app   # la build debug ha un'altra firma: va rimossa prima
adb install android/app/build/outputs/apk/release/app-release.apk
```

L'app usa ancora l'RPC pubblico di Solana (`EXPO_PUBLIC_SOLANA_RPC_URL` vuoto): mettere lì la chiave
Helius la incorporerebbe nell'APK, estraibile da chiunque. Da rivedere se l'RPC pubblico dà errori
di rate limit (soluzione: proxy RPC nell'engine).

## Operatività

- Kill switch: `curl -X POST https://<app>.fly.dev/admin/kill-switch -H "Authorization: Bearer $ADMIN_API_KEY" -H 'content-type: application/json' -d '{"active":true}'`
- Aggiornare: `fly deploy --ha=false`. Nuovi segreti: `node scripts/fly-secrets.mjs` + deploy.
- Backup del DB: `fly ssh sftp get /data/seeker-signal.db ./backup.db --app <app>`
  (con WAL attivo copiare anche `-wal` se presente, o fermare la macchina prima).
- `TRADING_MODE` resta `paper` in `fly.toml`: passare a `live` è una decisione esplicita.
