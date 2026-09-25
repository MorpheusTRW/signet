// Preflight della build release: EXPO_PUBLIC_* viene incorporato nel bundle al
// momento della build, quindi un URL sbagliato finirebbe nell'APK pubblicato.
import { readFileSync, existsSync } from 'node:fs'

function readEnv() {
  const env = { ...process.env }
  if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
      if (m && env[m[1]] === undefined) env[m[1]] = m[2]
    }
  }
  return env
}

const env = readEnv()
const url = env.EXPO_PUBLIC_ENGINE_API_URL ?? ''
const allowInsecure = env.ALLOW_INSECURE_ENGINE_URL === '1'
const problems = []

if (!existsSync('keystore.properties')) {
  problems.push('keystore.properties mancante (chiave di firma release).')
}
if (!allowInsecure) {
  if (!url.startsWith('https://')) {
    problems.push(
      `EXPO_PUBLIC_ENGINE_API_URL deve essere https:// (trovato "${url}"). Android release blocca il traffico HTTP in chiaro.`,
    )
  } else if (/localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.|\.local\b/.test(url)) {
    problems.push(`EXPO_PUBLIC_ENGINE_API_URL punta a un indirizzo locale: ${url}`)
  }
}

if (problems.length > 0) {
  console.error('Build release bloccata:\n - ' + problems.join('\n - '))
  console.error("\nPer una prova locale su un dispositivo: ALLOW_INSECURE_ENGINE_URL=1 (non pubblicare quell'APK).")
  process.exit(1)
}
if (allowInsecure) console.warn('ATTENZIONE: ALLOW_INSECURE_ENGINE_URL=1, APK solo per prove locali.')
console.log('Preflight release OK')
