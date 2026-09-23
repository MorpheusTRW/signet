import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";
import { buildServer } from "../src/server.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const app = buildServer(loadEnv({}));
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
