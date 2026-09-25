// Carica su Fly.io i segreti dell'engine leggendoli dal .env locale, senza
// stamparli e senza passare da una shell (argv diretto a flyctl).
// Uso: node scripts/fly-secrets.mjs [--app nome-app]
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const SECRET_KEYS = [
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'HELIUS_API_KEY',
  'SOLANA_RPC_URL',
  'TREASURY_WALLET_PUBKEY',
  'ADMIN_API_KEY',
  'PRIVACY_CONTROLLER_NAME',
  'PRIVACY_CONTACT_EMAIL',
  'PRIVACY_LAST_UPDATED',
]
const REQUIRED = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY', 'HELIUS_API_KEY', 'TREASURY_WALLET_PUBKEY', 'ADMIN_API_KEY']

const env = parseEnv(readFileSync(new URL('../.env', import.meta.url), 'utf8'))

// In produzione l'RPC è Helius (stessa chiave), non l'endpoint pubblico rate-limited.
if (env.HELIUS_API_KEY && (!env.SOLANA_RPC_URL || env.SOLANA_RPC_URL.includes('api.mainnet-beta.solana.com'))) {
  env.SOLANA_RPC_URL = `https://mainnet.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`
}

const missing = REQUIRED.filter((key) => !env[key])
if (missing.length > 0) {
  console.error(`Mancano nel .env: ${missing.join(', ')}`)
  process.exit(1)
}

const pairs = SECRET_KEYS.filter((key) => env[key]).map((key) => `${key}=${env[key]}`)
const appIndex = process.argv.indexOf('--app')
const appArgs = appIndex > -1 ? ['--app', process.argv[appIndex + 1]] : []

// --stage: registra i segreti senza riavviare; entrano in vigore al prossimo `fly deploy`.
const result = spawnSync('fly', ['secrets', 'set', '--stage', ...appArgs, ...pairs], { stdio: 'inherit' })
if (result.error) {
  console.error('flyctl non trovato: installalo con `brew install flyctl`')
  process.exit(1)
}
console.log(`Segreti caricati: ${SECRET_KEYS.filter((key) => env[key]).join(', ')}`)
process.exit(result.status ?? 1)
