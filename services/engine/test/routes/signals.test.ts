import { afterEach, describe, expect, it } from "vitest";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { createTestApp } from "./helpers.js";

describe("GET /signals", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("returns an empty list when there are no signals", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({ method: "GET", url: "/signals" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it("returns inserted signals, most recent first", async () => {
    ctx = createTestApp();
    const older = buildSignal(
      makeRawLaunchEvent({ id: "e1", createdAt: "2026-09-23T09:00:00.000Z" }),
    );
    const newer = buildSignal(
      makeRawLaunchEvent({ id: "e2", createdAt: "2026-09-23T11:00:00.000Z" }),
    );
    ctx.signalsRepo.insert(older);
    ctx.signalsRepo.insert(newer);

    const response = await ctx.app.inject({ method: "GET", url: "/signals" });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { id: string }[];
    expect(body.map((s) => s.id)).toEqual([newer.id, older.id]);
  });

  it("rejects an invalid limit", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({
      method: "GET",
      url: "/signals?limit=0",
    });
    expect(response.statusCode).toBe(400);
  });
});

describe("GET /signals/:id", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;

  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("returns the signal when found", async () => {
    ctx = createTestApp();
    const signal = buildSignal(makeRawLaunchEvent());
    ctx.signalsRepo.insert(signal);

    const response = await ctx.app.inject({
      method: "GET",
      url: `/signals/${signal.id}`,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(signal);
  });

  it("returns 404 when not found", async () => {
    ctx = createTestApp();
    const response = await ctx.app.inject({
      method: "GET",
      url: "/signals/does-not-exist",
    });
    expect(response.statusCode).toBe(404);
  });
});
