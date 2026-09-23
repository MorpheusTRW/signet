import { createHash, randomBytes } from "node:crypto";
import { pubkeySchema } from "@seeker-signal/shared";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { DevicesRepo } from "../db/devices-repo.js";

const registerDeviceBodySchema = z.object({
  fcmToken: z.string().min(1),
  walletPubkey: pubkeySchema,
});

function generateApiKey(): { plain: string; hash: string } {
  const plain = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(plain).digest("hex");
  return { plain, hash };
}

export function registerDevicesRoutes(
  app: FastifyInstance,
  devicesRepo: DevicesRepo,
): void {
  app.post("/devices", async (request, reply) => {
    const body = registerDeviceBodySchema.safeParse(request.body);
    if (!body.success) {
      return reply
        .status(400)
        .send({ error: "invalid_body", details: body.error.flatten() });
    }

    // Ogni registrazione rigenera l'API key: solo l'hash viene salvato, il
    // valore in chiaro va restituito qui e conservato lato client (F2, secure-store).
    const { plain, hash } = generateApiKey();
    const device = devicesRepo.upsert({
      walletPubkey: body.data.walletPubkey,
      fcmToken: body.data.fcmToken,
      apiKeyHash: hash,
    });

    return reply.status(201).send({
      deviceId: device.id,
      walletPubkey: device.walletPubkey,
      apiKey: plain,
      createdAt: device.createdAt,
    });
  });
}
