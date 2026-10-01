import type { RawLaunchEvent } from "../ingest/event-source.js";
import { MIN_NORMAL_MIGRATION_LIQUIDITY_SOL } from "./prefilter.js";
import type { FilterCheck } from "./types.js";

/*
 * Regole calibrate con scripts/backtest-migrations.ts su 49 migrazioni reali
 * (2026-09-26, esito a 1,5–2,5 h): 40 hanno perso oltre l'80%. Pattern osservati:
 * - migrate entro ~1 minuto dal lancio (curva comprata dal dev/bundle): 21 rug su 22
 * - "migrazioni" con liquidità molto sotto gli ~85 SOL standard: 13 rug su 13
 * - dev che compra >50% della supply al lancio: rug in tutti i casi tranne 1
 * Campione piccolo e finestra breve: sono euristiche, non garanzie.
 */


export function checkAnomalousMigration(event: RawLaunchEvent): FilterCheck {
  if (event.pumpMigration && event.initialLiquiditySol < MIN_NORMAL_MIGRATION_LIQUIDITY_SOL) {
    return {
      id: "anomalous-migration",
      passed: false,
      reason: `Abnormal migration: ${event.initialLiquiditySol.toFixed(2)} SOL liquidity (a normal one has ~85)`,
      riskPoints: 70,
    };
  }
  return { id: "anomalous-migration", passed: true, reason: "Standard migration", riskPoints: 0 };
}

export function checkMigrationSpeed(event: RawLaunchEvent): FilterCheck {
  const minutes = event.launch?.minutesToMigrate;
  if (minutes !== undefined && minutes <= 2) {
    return {
      id: "migration-speed",
      passed: false,
      reason: `Migrated ${minutes} min after launch: curve bought out by dev/bundle`,
      riskPoints: 70,
    };
  }
  return { id: "migration-speed", passed: true, reason: "Normal time to migration", riskPoints: 0 };
}

export function checkDevBuy(event: RawLaunchEvent): FilterCheck {
  const launch = event.launch;
  if (!launch) return { id: "dev-buy", passed: true, reason: "Dev initial buy not analyzed", riskPoints: 0 };
  const pct = launch.devBuyPct;
  // Chi compra nello stesso blocco della creazione agisce d'accordo col dev: dev + bundle
  // sono di fatto la stessa mano (es. un solo wallet "esterno" che prende il 60% al lancio).
  const insiders = Number((pct + launch.bundlePct).toFixed(2));
  if (pct >= 50) {
    return { id: "dev-buy", passed: false, reason: `Dev bought ${pct}% of supply at launch`, riskPoints: 50 };
  }
  if (insiders >= 50) {
    return {
      id: "dev-buy",
      passed: false,
      reason: `Dev + bundle bought ${insiders}% of supply at launch`,
      riskPoints: 50,
    };
  }
  if (pct >= 20) {
    return { id: "dev-buy", passed: false, reason: `Dev bought ${pct}% of supply at launch`, riskPoints: 15 };
  }
  return { id: "dev-buy", passed: true, reason: "Dev initial buy is small", riskPoints: 0 };
}

/** Soglie allineate ai default di GMGN (bundler 10%): oltre il 30% è quasi certamente un lancio "preparato". */
export function checkBundle(event: RawLaunchEvent): FilterCheck {
  const launch = event.launch;
  if (!launch) return { id: "bundle", passed: true, reason: "Bundle not analyzed", riskPoints: 0 };
  const linked = launch.linkedWallets >= 3 ? `, ${launch.linkedWallets} linked wallets` : "";
  const wallets = launch.bundleWallets === 1 ? "1 wallet" : `${launch.bundleWallets} wallets`;
  const reason = `Bundle: ${wallets} bought ${launch.bundlePct}% in the launch block${linked}`;
  if (launch.bundlePct >= 30) return { id: "bundle", passed: false, reason, riskPoints: 30 };
  if (launch.bundlePct >= 10) return { id: "bundle", passed: false, reason, riskPoints: 15 };
  if (launch.linkedWallets >= 3) {
    return {
      id: "bundle",
      passed: false,
      reason: `${launch.linkedWallets} early buyers with fees paid by other wallets (same operator)`,
      riskPoints: 10,
    };
  }
  return { id: "bundle", passed: true, reason: "No significant bundle at launch", riskPoints: 0 };
}

/** Wallet dev "usa e getta": ricaricato poco prima del lancio. */
export function checkFreshDevWallet(event: RawLaunchEvent): FilterCheck {
  const minutes = event.launch?.devFundedMinutesBeforeLaunch;
  if (minutes !== null && minutes !== undefined && minutes < 60) {
    return {
      id: "fresh-dev-wallet",
      passed: false,
      reason: `Dev wallet activated ${Math.max(0, Math.round(minutes))} min before launch (burner)`,
      // 2026-10-01: wallet dev appena creati crollano più degli altri (80% contro 60–70%).
      riskPoints: 35,
    };
  }
  return { id: "fresh-dev-wallet", passed: true, reason: "Dev wallet not created for this launch", riskPoints: 0 };
}
