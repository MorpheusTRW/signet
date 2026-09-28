import { describe, expect, it } from "vitest";
import {
  checkAnomalousMigration,
  checkBundle,
  checkDevBuy,
  checkFreshDevWallet,
  checkMigrationSpeed,
} from "../../src/filters/launch-pattern.js";
import type { LaunchPattern } from "../../src/ingest/event-source.js";
import { computeRiskReport } from "../../src/filters/risk-report.js";
import { makeRawLaunchEvent } from "../fixtures.js";

const organic: LaunchPattern = {
  minutesToMigrate: 90,
  bundleWallets: 0,
  bundlePct: 0,
  devBuyPct: 2,
  snipersPct: 1,
  linkedWallets: 0,
  devFundedMinutesBeforeLaunch: 60 * 24 * 30,
};

describe("launch-pattern", () => {
  it("migrazione con liquidità molto sotto lo standard", () => {
    expect(checkAnomalousMigration(makeRawLaunchEvent({ pumpMigration: true, initialLiquiditySol: 2 })).riskPoints).toBe(70);
    expect(checkAnomalousMigration(makeRawLaunchEvent({ pumpMigration: true, initialLiquiditySol: 85 })).passed).toBe(true);
    // Solo per migrazioni reali: gli eventi sintetici non sono migrazioni pump.fun.
    expect(checkAnomalousMigration(makeRawLaunchEvent({ initialLiquiditySol: 2 })).passed).toBe(true);
  });

  it("migrazione quasi istantanea", () => {
    const check = checkMigrationSpeed(makeRawLaunchEvent({ launch: { ...organic, minutesToMigrate: 0 } }));
    expect(check.riskPoints).toBe(70);
    expect(checkMigrationSpeed(makeRawLaunchEvent({ launch: organic })).passed).toBe(true);
  });

  it("dev buy", () => {
    expect(checkDevBuy(makeRawLaunchEvent({ launch: { ...organic, devBuyPct: 79.7 } })).riskPoints).toBe(50);
    expect(checkDevBuy(makeRawLaunchEvent({ launch: { ...organic, devBuyPct: 26 } })).riskPoints).toBe(15);
    expect(checkDevBuy(makeRawLaunchEvent({ launch: organic })).passed).toBe(true);
  });

  it("dev + bundle oltre il 50% al lancio = stessa mano", () => {
    // Caso reale MAXWELL: un solo wallet ha preso il 60,85% nello stesso blocco della creazione.
    const check = checkDevBuy(makeRawLaunchEvent({ launch: { ...organic, devBuyPct: 0, bundleWallets: 1, bundlePct: 60.85 } }));
    expect(check.riskPoints).toBe(50);
    expect(check.reason).toBe("Dev e bundle hanno comprato il 60.85% della supply al lancio");
    const single = checkBundle(makeRawLaunchEvent({ launch: { ...organic, bundleWallets: 1, bundlePct: 60.85 } }));
    expect(single.reason).toContain("1 wallet ha comprato");
  });

  it("bundle e wallet collegati", () => {
    const heavy = checkBundle(makeRawLaunchEvent({ launch: { ...organic, bundleWallets: 6, bundlePct: 24, linkedWallets: 3 } }));
    expect(heavy.riskPoints).toBe(15);
    expect(heavy.reason).toBe("Bundle: 6 wallet hanno comprato il 24% nello stesso blocco del lancio, 3 wallet collegati");
    expect(checkBundle(makeRawLaunchEvent({ launch: { ...organic, bundlePct: 35 } })).riskPoints).toBe(30);
    expect(checkBundle(makeRawLaunchEvent({ launch: { ...organic, linkedWallets: 4 } })).riskPoints).toBe(10);
    expect(checkBundle(makeRawLaunchEvent({ launch: organic })).passed).toBe(true);
  });

  it("wallet dev usa e getta", () => {
    expect(checkFreshDevWallet(makeRawLaunchEvent({ launch: { ...organic, devFundedMinutesBeforeLaunch: 0.02 } })).reason).toBe(
      "Wallet dev attivato 0 min prima del lancio (usa e getta)",
    );
    expect(checkFreshDevWallet(makeRawLaunchEvent({ launch: { ...organic, devFundedMinutesBeforeLaunch: null } })).passed).toBe(true);
  });

  it("il caso GOLIT (rug reale) ora non risulta più a rischio basso", () => {
    // Dati reali del 2026-09-26: dev ricaricato 1 s prima, 6 wallet nello stesso blocco (24%), fee condivise.
    const golit = makeRawLaunchEvent({
      pumpMigration: true,
      initialLiquiditySol: 85,
      snipedWalletsCount: 9,
      devWalletHistory: { previousLaunches: 0, previousLaunchesMigrated: 0, previousRugs: 0, walletAgeDays: 0 },
      unverified: ["dev-rugs"],
      launch: { minutesToMigrate: 8, bundleWallets: 6, bundlePct: 24, devBuyPct: 3.6, snipersPct: 27.7, linkedWallets: 2, devFundedMinutesBeforeLaunch: 0.02 },
    });
    expect(computeRiskReport(golit).level).not.toBe("low");
  });
});
