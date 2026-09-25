import { afterEach, describe, expect, it } from "vitest";
import { simulatePaperTrade } from "../../src/paper-trading/engine.js";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { createTestApp } from "./helpers.js";

describe("GET /positions", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;
  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  it("riepiloga esposizione e margine residuo", async () => {
    ctx = createTestApp({ paperTradingConfig: { portfolioValueSol: 100, maxExposureFraction: 0.2 } });
    const signal = buildSignal(makeRawLaunchEvent({ tokenSymbol: "ABC" }));
    ctx.signalsRepo.insert(signal);
    ctx.paperTradesRepo.insert(simulatePaperTrade(signal, 4));

    const res = await ctx.app.inject({ method: "GET", url: "/positions" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.portfolio.openExposureSol).toBe(4);
    expect(body.portfolio.remainingSol).toBe(16);
    expect(body.positions).toHaveLength(1);
    expect(body.positions[0].tokenSymbol).toBe("ABC");
  });

  it("400 su limit non valido", async () => {
    ctx = createTestApp();
    const res = await ctx.app.inject({ method: "GET", url: "/positions?limit=0" });
    expect(res.statusCode).toBe(400);
  });
});
