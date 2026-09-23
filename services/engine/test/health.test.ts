import { describe, expect, it } from "vitest";
import { createDb } from "../src/db/client.js";
import { DevicesRepo } from "../src/db/devices-repo.js";
import { SignalsRepo } from "../src/db/signals-repo.js";
import { loadEnv } from "../src/env.js";
import { buildServer } from "../src/server.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const db = createDb(":memory:");
    const app = buildServer(loadEnv({ NODE_ENV: "test" }), {
      signalsRepo: new SignalsRepo(db),
      devicesRepo: new DevicesRepo(db),
    });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
    db.close();
  });
});
