import { afterEach, describe, expect, it } from "vitest";
import { createDb, type DbClient } from "../../src/db/client.js";
import { DevicesRepo } from "../../src/db/devices-repo.js";
import { PushNotificationsRepo } from "../../src/db/push-notifications-repo.js";
import { SignalDeliveriesRepo } from "../../src/db/signal-deliveries-repo.js";
import { SignalsRepo } from "../../src/db/signals-repo.js";
import { SubscriptionsRepo } from "../../src/db/subscriptions-repo.js";
import type { HolderChecker } from "../../src/entitlements/holder-check.js";
import { scheduleSignalPush } from "../../src/push/schedule-signal-push.js";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeTierConfig } from "../entitlements/fixtures.js";
import { makeRawLaunchEvent } from "../fixtures.js";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

function holderChecker(result: boolean): HolderChecker {
  return { async isHolder() { return result; } };
}

function setup(isHolder = false) {
  const db: DbClient = createDb(":memory:");
  const devicesRepo = new DevicesRepo(db);
  const pushNotificationsRepo = new PushNotificationsRepo(db);
  const signalDeliveriesRepo = new SignalDeliveriesRepo(db);
  const subscriptionsRepo = new SubscriptionsRepo(db);
  const signalsRepo = new SignalsRepo(db);

  const device = devicesRepo.upsert({
    walletPubkey: WALLET,
    fcmToken: "fcm-token-1",
    apiKeyHash: "hash",
  });

  const tierConfig = makeTierConfig({
    free: { signalDelaySeconds: 45, maxSignalsPerDay: 3, historyHours: 24, platformFeeBps: 75 },
  });

  const deps = {
    devicesRepo,
    pushNotificationsRepo,
    signalDeliveriesRepo,
    resolveTierDeps: {
      subscriptionsRepo,
      holderChecker: holderChecker(isHolder),
      tierConfig,
    },
  };

  function insertSignal() {
    const signal = buildSignal(makeRawLaunchEvent());
    signalsRepo.insert(signal);
    return signal;
  }

  return { db, device, deps, signalDeliveriesRepo, pushNotificationsRepo, insertSignal };
}

describe("scheduleSignalPush", () => {
  let db: DbClient | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("schedules HOLDER pushes immediately, with no daily quota tracking", async () => {
    const ctx = setup(true);
    db = ctx.db;
    const signal = ctx.insertSignal();

    await scheduleSignalPush(signal, ctx.deps, NOW);

    const rows = ctx.pushNotificationsRepo.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: "signal", signalId: signal.id, scheduledAt: NOW.toISOString() });
    expect(ctx.signalDeliveriesRepo.listDeliveredTodayIds(ctx.device.walletPubkey, NOW).size).toBe(0);
  });

  it("schedules a FREE push after the configured delay and reserves the daily quota", async () => {
    const ctx = setup(false);
    db = ctx.db;
    const signal = ctx.insertSignal();

    await scheduleSignalPush(signal, ctx.deps, NOW);

    const rows = ctx.pushNotificationsRepo.list();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.type).toBe("signal");
    expect(rows[0]!.scheduledAt).toBe(new Date(NOW.getTime() + 45_000).toISOString());
    expect(ctx.signalDeliveriesRepo.listDeliveredTodayIds(ctx.device.walletPubkey, NOW).has(signal.id)).toBe(true);
  });

  it("schedules a single limit-reached push exactly when the FREE quota is exhausted", async () => {
    const ctx = setup(false);
    db = ctx.db;

    // Consuma manualmente 2 delle 3 quote giornaliere (limite di default nel fixture).
    const prior = [ctx.insertSignal(), ctx.insertSignal()].map((s) => s.id);
    ctx.signalDeliveriesRepo.record(ctx.device.walletPubkey, prior, NOW);

    const signal = ctx.insertSignal();
    await scheduleSignalPush(signal, ctx.deps, NOW);

    const rows = ctx.pushNotificationsRepo.list();
    const types = rows.map((r) => r.type).sort();
    expect(types).toEqual(["limit-reached", "signal"]);

    const limitReached = rows.find((r) => r.type === "limit-reached")!;
    expect(limitReached.data.route).toBe("/plans");
    expect(limitReached.scheduledAt).toBe(new Date(NOW.getTime() + 45_000).toISOString());
  });

  it("schedules nothing once the FREE quota is already exhausted", async () => {
    const ctx = setup(false);
    db = ctx.db;
    const prior = [ctx.insertSignal(), ctx.insertSignal(), ctx.insertSignal()].map((s) => s.id);
    ctx.signalDeliveriesRepo.record(ctx.device.walletPubkey, prior, NOW);

    const signal = ctx.insertSignal();
    await scheduleSignalPush(signal, ctx.deps, NOW);

    expect(ctx.pushNotificationsRepo.list()).toHaveLength(0);
  });

  it("never schedules a second limit-reached push the same day", async () => {
    const ctx = setup(false);
    db = ctx.db;
    ctx.pushNotificationsRepo.schedule({
      deviceId: ctx.device.id,
      walletPubkey: ctx.device.walletPubkey,
      signalId: null,
      type: "limit-reached",
      title: "Limite raggiunto",
      body: "already sent earlier today",
      data: { type: "limit-reached", route: "/plans" },
      scheduledAt: NOW,
    });
    const prior = [ctx.insertSignal(), ctx.insertSignal()].map((s) => s.id);
    ctx.signalDeliveriesRepo.record(ctx.device.walletPubkey, prior, NOW);

    const signal = ctx.insertSignal();
    await scheduleSignalPush(signal, ctx.deps, NOW);

    const limitReachedRows = ctx.pushNotificationsRepo.list().filter((r) => r.type === "limit-reached");
    expect(limitReachedRows).toHaveLength(1);
  });

  it("schedules pushes for every registered device", async () => {
    const ctx = setup(false);
    db = ctx.db;
    ctx.deps.devicesRepo.upsert({
      walletPubkey: "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
      fcmToken: "fcm-token-2",
      apiKeyHash: "hash-2",
    });

    const signal = ctx.insertSignal();
    await scheduleSignalPush(signal, ctx.deps, NOW);

    expect(ctx.pushNotificationsRepo.list()).toHaveLength(2);
  });

  it("non invia push per i segnali ad alto rischio (salvo pushHighRisk)", async () => {
    const ctx = setup(true);
    db = ctx.db;
    const inserted = ctx.insertSignal();
    const signal = { ...inserted, riskReport: { score: 90, level: "high" as const, reasons: ["x"] } };

    await scheduleSignalPush(signal, ctx.deps, NOW);
    expect(ctx.pushNotificationsRepo.list()).toHaveLength(0);

    await scheduleSignalPush(signal, { ...ctx.deps, pushHighRisk: true }, NOW);
    expect(ctx.pushNotificationsRepo.list()).toHaveLength(1);
  });
});
