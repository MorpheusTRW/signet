import { afterEach, describe, expect, it, vi } from "vitest";
import { createDb, type DbClient } from "../../src/db/client.js";
import { DevicesRepo } from "../../src/db/devices-repo.js";
import { PushNotificationsRepo } from "../../src/db/push-notifications-repo.js";
import { dispatchDuePushNotifications } from "../../src/push/dispatcher.js";
import type { PushSender } from "../../src/push/sender.js";

const NOW = new Date("2026-09-23T12:00:00.000Z");
const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

function setup() {
  const db: DbClient = createDb(":memory:");
  const devicesRepo = new DevicesRepo(db);
  const pushNotificationsRepo = new PushNotificationsRepo(db);
  const device = devicesRepo.upsert({
    walletPubkey: WALLET,
    fcmToken: "fcm-token-1",
    apiKeyHash: "hash",
  });
  return { db, devicesRepo, pushNotificationsRepo, device };
}

describe("dispatchDuePushNotifications", () => {
  let db: DbClient | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("sends due notifications and marks them sent", async () => {
    const ctx = setup();
    db = ctx.db;
    const notification = ctx.pushNotificationsRepo.schedule({
      deviceId: ctx.device.id,
      walletPubkey: ctx.device.walletPubkey,
      signalId: null,
      type: "signal",
      title: "Nuovo segnale",
      body: "body",
      data: { type: "signal", route: "/signal/abc" },
      scheduledAt: NOW,
    });

    const send = vi.fn().mockResolvedValue("message-id-1");
    const sender: PushSender = { send };

    await dispatchDuePushNotifications(
      { pushNotificationsRepo: ctx.pushNotificationsRepo, devicesRepo: ctx.devicesRepo, sender },
      NOW,
    );

    expect(send).toHaveBeenCalledWith({
      fcmToken: "fcm-token-1",
      title: "Nuovo segnale",
      body: "body",
      data: { type: "signal", route: "/signal/abc" },
    });
    const [sent] = ctx.pushNotificationsRepo.list();
    expect(sent!.id).toBe(notification.id);
    expect(sent!.status).toBe("sent");
    expect(sent!.sentAt).toBe(NOW.toISOString());
  });

  it("does not send notifications scheduled in the future", async () => {
    const ctx = setup();
    db = ctx.db;
    ctx.pushNotificationsRepo.schedule({
      deviceId: ctx.device.id,
      walletPubkey: ctx.device.walletPubkey,
      signalId: null,
      type: "signal",
      title: "t",
      body: "b",
      data: {},
      scheduledAt: new Date(NOW.getTime() + 60_000),
    });

    const send = vi.fn();
    await dispatchDuePushNotifications(
      { pushNotificationsRepo: ctx.pushNotificationsRepo, devicesRepo: ctx.devicesRepo, sender: { send } },
      NOW,
    );

    expect(send).not.toHaveBeenCalled();
    expect(ctx.pushNotificationsRepo.list()[0]!.status).toBe("pending");
  });

  it("marks a notification failed when the sender throws, without retrying it later", async () => {
    const ctx = setup();
    db = ctx.db;
    ctx.pushNotificationsRepo.schedule({
      deviceId: ctx.device.id,
      walletPubkey: ctx.device.walletPubkey,
      signalId: null,
      type: "signal",
      title: "t",
      body: "b",
      data: {},
      scheduledAt: NOW,
    });

    const send = vi.fn().mockRejectedValue(new Error("invalid token"));
    await dispatchDuePushNotifications(
      { pushNotificationsRepo: ctx.pushNotificationsRepo, devicesRepo: ctx.devicesRepo, sender: { send } },
      NOW,
    );

    const [row] = ctx.pushNotificationsRepo.list();
    expect(row!.status).toBe("failed");
    expect(row!.error).toBe("invalid token");

    expect(ctx.pushNotificationsRepo.listDue(NOW)).toHaveLength(0);
  });

  it("marks failed when the device can't be found, without calling the sender", async () => {
    // Il vincolo FK di push_notifications impedisce di cancellare un device
    // referenziato da una notifica reale: per esercitare questo ramo
    // difensivo del dispatcher si usano repo fittizie invece del DB vero.
    const pendingNotification = {
      id: "notif-1",
      deviceId: "missing-device",
      walletPubkey: WALLET,
      signalId: null,
      type: "signal" as const,
      title: "t",
      body: "b",
      data: {},
      scheduledAt: NOW.toISOString(),
      sentAt: null,
      status: "pending" as const,
      error: null,
    };
    const markFailed = vi.fn();
    const fakePushNotificationsRepo = {
      listDue: () => [pendingNotification],
      markSent: vi.fn(),
      markFailed,
    };
    const fakeDevicesRepo = { findById: () => undefined };
    const send = vi.fn();

    await dispatchDuePushNotifications(
      {
        pushNotificationsRepo: fakePushNotificationsRepo as never,
        devicesRepo: fakeDevicesRepo as never,
        sender: { send },
      },
      NOW,
    );

    expect(send).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith("notif-1", "device non trovato");
  });
});
