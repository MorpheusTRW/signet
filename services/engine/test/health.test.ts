import { describe, expect, it } from "vitest";
import { createTestApp } from "./routes/helpers.js";

describe("GET /health", () => {
  it("returns ok", async () => {
    const ctx = createTestApp();
    const response = await ctx.app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await ctx.app.close();
    ctx.db.close();
  });
});
