import { afterEach, describe, expect, it, vi } from "vitest";
import { processLaunchEvent } from "../../src/signals/pipeline.js";
import { makeRawLaunchEvent } from "../fixtures.js";
import { createTestApp } from "./helpers.js";

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const acc = (ui: string) => ({ data: { parsed: { info: { tokenAmount: { uiAmountString: ui } } } } });
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** Migrazione con liquidità anomala: il filtro la porta a rischio alto (scartata). */
const rejected = (id: string, symbol: string, createdAt: string) =>
  makeRawLaunchEvent({
    id,
    tokenSymbol: symbol,
    createdAt,
    pumpMigration: true,
    initialLiquiditySol: 5,
    market: { baseVault: `B${id}`, quoteVault: `Q${id}`, priceSol: 0.0001 },
  });

describe("radar, rug schivati e recap", () => {
  let ctx: ReturnType<typeof createTestApp> | undefined;
  afterEach(async () => {
    await ctx?.app.close();
    ctx?.db.close();
    ctx = undefined;
  });

  function seed() {
    // Letture dal più recente: OK1 a -10%, RUG2 a -99%, pool di RUG1 svuotata (null).
    const rpc = vi.fn(async () => ({
      value: [acc("1000000"), acc("90"), acc("100000000"), acc("100"), null, null],
    }));
    ctx = createTestApp({ priceRpc: rpc as never, trackRecordSource: "real" });
    const events = [
      rejected("r1", "RUG1", minutesAgo(30)),
      rejected("r2", "RUG2", minutesAgo(20)),
      rejected("r3", "OK1", minutesAgo(10)),
      makeRawLaunchEvent({ id: "s1", tokenSymbol: "GOOD", createdAt: minutesAgo(5) }),
    ];
    const signals = events.map((event) => processLaunchEvent(event, ctx!));
    return { rpc, signals };
  }

  it("GET /radar conta i token valutati e scartati oggi e mostra gli ultimi scarti col motivo", async () => {
    const { signals } = seed();
    expect(signals.slice(0, 3).every((s) => s.riskReport.level === "high")).toBe(true);
    const res = await ctx!.app.inject({ method: "GET", url: "/radar" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.scannedToday).toBeGreaterThanOrEqual(1);
    expect(body.rejectedToday).toBeLessThanOrEqual(body.scannedToday);
    expect(body.recentRejected.map((r: { tokenSymbol: string }) => r.tokenSymbol)).toEqual(["OK1", "RUG2", "RUG1"]);
    // Il motivo mostrato è quello più pesante.
    expect(body.recentRejected[0].reason).toMatch(/Abnormal migration/);
  });

  it("GET /dodged: solo gli scartati crollati oltre la soglia, prezzo letto dalla pool", async () => {
    const { rpc } = seed();
    const res = await ctx!.app.inject({ method: "GET", url: `/dodged?pubkey=${WALLET}` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.rejectedCount).toBe(3);
    expect(body.rugCount).toBe(2);
    expect(body.rugs.map((r: { tokenSymbol: string; changePct: number }) => [r.tokenSymbol, r.changePct])).toEqual([
      ["RUG2", -99],
      ["RUG1", -100],
    ]);
    expect(body.streak).toMatchObject({ days: 0, panicSellWindowMinutes: 15, maxExposureFraction: 0.2 });

    // Seconda richiesta entro il TTL: nessuna nuova lettura on-chain.
    await ctx!.app.inject({ method: "GET", url: "/dodged" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("GET /recap: settimana ISO, rug schivati, segnali approvati e streak del wallet", async () => {
    const { signals } = seed();
    ctx!.devicesRepo.upsert({ walletPubkey: WALLET, fcmToken: "fcm", apiKeyHash: "hash" });
    ctx!.userPositionsRepo.open({
      walletPubkey: WALLET,
      signalId: signals[3]!.id,
      mode: "paper",
      sizeSol: 0.2,
      tokenAmount: 1000,
      entryPriceSol: 0.0002,
    });
    const res = await ctx!.app.inject({ method: "GET", url: `/recap?pubkey=${WALLET}` });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ rugsDodged: 2, signalsApproved: 1, streakDays: 1 });
    expect(res.json().week).toBeGreaterThanOrEqual(1);
  });

  it("GET /recap richiede una pubkey valida", async () => {
    seed();
    const res = await ctx!.app.inject({ method: "GET", url: "/recap?pubkey=nope" });
    expect(res.statusCode).toBe(400);
  });
});
