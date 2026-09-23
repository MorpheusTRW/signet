import { afterEach, describe, expect, it } from "vitest";
import { createDb, type DbClient } from "../../src/db/client.js";
import { SubscriptionsRepo } from "../../src/db/subscriptions-repo.js";
import type { HolderChecker } from "../../src/entitlements/holder-check.js";
import { resolveTier } from "../../src/entitlements/resolve-tier.js";
import { makeTierConfig } from "./fixtures.js";

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const NOW = new Date("2026-09-23T12:00:00.000Z");

function holderChecker(result: boolean): HolderChecker {
  return { async isHolder() { return result; } };
}

describe("resolveTier", () => {
  let db: DbClient | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("defaults to free when there is no subscription and the wallet is not a holder", async () => {
    db = createDb(":memory:");
    const resolution = await resolveTier(
      WALLET,
      {
        subscriptionsRepo: new SubscriptionsRepo(db),
        holderChecker: holderChecker(false),
        tierConfig: makeTierConfig(),
      },
      NOW,
    );
    expect(resolution.tier).toBe("free");
    expect(resolution.expiresAt).toBeNull();
    expect(resolution.limits.signalDelaySeconds).toBe(45);
  });

  it("resolves to pro when there is an active subscription", async () => {
    db = createDb(":memory:");
    const subscriptionsRepo = new SubscriptionsRepo(db);
    subscriptionsRepo.insert({
      walletPubkey: WALLET,
      expiresAt: "2026-10-01T00:00:00.000Z",
      paymentSignature: "sig-1",
    });

    const resolution = await resolveTier(
      WALLET,
      {
        subscriptionsRepo,
        holderChecker: holderChecker(false),
        tierConfig: makeTierConfig(),
      },
      NOW,
    );
    expect(resolution.tier).toBe("pro");
    expect(resolution.expiresAt).toBe("2026-10-01T00:00:00.000Z");
    expect(resolution.limits.signalDelaySeconds).toBe(0);
  });

  it("treats an expired subscription as free", async () => {
    db = createDb(":memory:");
    const subscriptionsRepo = new SubscriptionsRepo(db);
    subscriptionsRepo.insert({
      walletPubkey: WALLET,
      expiresAt: "2026-09-01T00:00:00.000Z", // before NOW
      paymentSignature: "sig-1",
    });

    const resolution = await resolveTier(
      WALLET,
      {
        subscriptionsRepo,
        holderChecker: holderChecker(false),
        tierConfig: makeTierConfig(),
      },
      NOW,
    );
    expect(resolution.tier).toBe("free");
  });

  it("holder status wins over a paid pro subscription (holder = pro gratis)", async () => {
    db = createDb(":memory:");
    const subscriptionsRepo = new SubscriptionsRepo(db);
    subscriptionsRepo.insert({
      walletPubkey: WALLET,
      expiresAt: "2026-10-01T00:00:00.000Z",
      paymentSignature: "sig-1",
    });

    const resolution = await resolveTier(
      WALLET,
      {
        subscriptionsRepo,
        holderChecker: holderChecker(true),
        tierConfig: makeTierConfig(),
      },
      NOW,
    );
    expect(resolution.tier).toBe("holder");
    expect(resolution.expiresAt).toBeNull();
    expect(resolution.limits.platformFeeBps).toBe(30);
  });
});
