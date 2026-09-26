import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

/*
 * Regole calibrate con scripts/backtest-migrations.ts su 49 migrazioni reali
 * (2026-09-26, esito a 1,5–2,5 h): 40 hanno perso oltre l'80%. Pattern osservati:
 * - migrate entro ~1 minuto dal lancio (curva comprata dal dev/bundle): 21 rug su 22
 * - "migrazioni" con liquidità molto sotto gli ~85 SOL standard: 13 rug su 13
 * - dev che compra >50% della supply al lancio: rug in tutti i casi tranne 1
 * Campione piccolo e finestra breve: sono euristiche, non garanzie.
 */

/** Liquidità di una migrazione pump.fun standard: ~85 SOL. Molto meno è anomalo. */
const MIN_NORMAL_MIGRATION_LIQUIDITY_SOL = 80;

export function checkAnomalousMigration(event: RawLaunchEvent): FilterCheck {
  if (event.pumpMigration && event.initialLiquiditySol < MIN_NORMAL_MIGRATION_LIQUIDITY_SOL) {
    return {
      id: "anomalous-migration",
      passed: false,
      reason: `Migrazione anomala: ${event.initialLiquiditySol.toFixed(2)} SOL di liquidità (una normale ne ha ~85)`,
      riskPoints: 70,
    };
  }
  return { id: "anomalous-migration", passed: true, reason: "Migrazione standard", riskPoints: 0 };
}

export function checkMigrationSpeed(event: RawLaunchEvent): FilterCheck {
  const minutes = event.launch?.minutesToMigrate;
  if (minutes !== undefined && minutes <= 2) {
    return {
      id: "migration-speed",
      passed: false,
      reason: `Migrato ${minutes} min dopo il lancio: curva comprata subito da dev/bundle`,
      riskPoints: 70,
    };
  }
  return { id: "migration-speed", passed: true, reason: "Tempo di migrazione normale", riskPoints: 0 };
}

export function checkDevBuy(event: RawLaunchEvent): FilterCheck {
  const pct = event.launch?.devBuyPct;
  if (pct !== undefined && pct >= 50) {
    return { id: "dev-buy", passed: false, reason: `Il dev ha comprato il ${pct}% della supply al lancio`, riskPoints: 50 };
  }
  if (pct !== undefined && pct >= 20) {
    return { id: "dev-buy", passed: false, reason: `Il dev ha comprato il ${pct}% della supply al lancio`, riskPoints: 15 };
  }
  return { id: "dev-buy", passed: true, reason: "Acquisto iniziale del dev contenuto", riskPoints: 0 };
}

/** Soglie allineate ai default di GMGN (bundler 10%): oltre il 30% è quasi certamente un lancio "preparato". */
export function checkBundle(event: RawLaunchEvent): FilterCheck {
  const launch = event.launch;
  if (!launch) return { id: "bundle", passed: true, reason: "Bundle non analizzato", riskPoints: 0 };
  const linked = launch.linkedWallets >= 3 ? `, ${launch.linkedWallets} wallet collegati` : "";
  const reason = `Bundle: ${launch.bundleWallets} wallet hanno comprato il ${launch.bundlePct}% nello stesso blocco del lancio${linked}`;
  if (launch.bundlePct >= 30) return { id: "bundle", passed: false, reason, riskPoints: 30 };
  if (launch.bundlePct >= 10) return { id: "bundle", passed: false, reason, riskPoints: 15 };
  if (launch.linkedWallets >= 3) {
    return {
      id: "bundle",
      passed: false,
      reason: `${launch.linkedWallets} acquirenti iniziali con fee pagate da altri wallet (stesso operatore)`,
      riskPoints: 10,
    };
  }
  return { id: "bundle", passed: true, reason: "Nessun bundle rilevante al lancio", riskPoints: 0 };
}

/** Wallet dev "usa e getta": ricaricato poco prima del lancio. */
export function checkFreshDevWallet(event: RawLaunchEvent): FilterCheck {
  const minutes = event.launch?.devFundedMinutesBeforeLaunch;
  if (minutes !== null && minutes !== undefined && minutes < 60) {
    return {
      id: "fresh-dev-wallet",
      passed: false,
      reason: `Wallet dev attivato ${Math.max(0, Math.round(minutes))} min prima del lancio (usa e getta)`,
      riskPoints: 15,
    };
  }
  return { id: "fresh-dev-wallet", passed: true, reason: "Wallet dev non creato per il lancio", riskPoints: 0 };
}
