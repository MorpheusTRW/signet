import type { DevicesRepo } from "../db/devices-repo.js";
import type { PushNotificationsRepo } from "../db/push-notifications-repo.js";
import type { PushSender } from "./sender.js";

export interface DispatchPushDeps {
  pushNotificationsRepo: PushNotificationsRepo;
  devicesRepo: DevicesRepo;
  sender: PushSender;
}

/** Invia tutte le notifiche pianificate la cui `scheduledAt` è già passata. */
export async function dispatchDuePushNotifications(
  deps: DispatchPushDeps,
  now: Date = new Date(),
): Promise<void> {
  for (const notification of deps.pushNotificationsRepo.listDue(now)) {
    const device = deps.devicesRepo.findById(notification.deviceId);
    if (!device) {
      deps.pushNotificationsRepo.markFailed(notification.id, "device non trovato");
      continue;
    }

    try {
      await deps.sender.send({
        fcmToken: device.fcmToken,
        title: notification.title,
        body: notification.body,
        data: notification.data,
      });
      deps.pushNotificationsRepo.markSent(notification.id, now);
    } catch (error) {
      deps.pushNotificationsRepo.markFailed(
        notification.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }
}

export interface Logger {
  warn(message: string, err?: unknown): void;
}

/** Sweep periodico: pianificazione e invio restano disaccoppiati dalle richieste HTTP. */
export function startPushDispatcher(
  deps: DispatchPushDeps,
  intervalMs: number,
  logger: Logger,
): () => void {
  const timer = setInterval(() => {
    dispatchDuePushNotifications(deps).catch((error: unknown) => {
      logger.warn("push dispatch fallito", error);
    });
  }, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
