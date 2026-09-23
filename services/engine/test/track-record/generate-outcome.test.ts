import { describe, expect, it } from "vitest";
import { generateSyntheticOutcome } from "../../src/track-record/generate-outcome.js";

describe("generateSyntheticOutcome", () => {
  it("is deterministic for the same signal id and category", () => {
    const a = generateSyntheticOutcome("sig-1", "discarded");
    const b = generateSyntheticOutcome("sig-1", "discarded");
    expect(a).toEqual(b);
  });

  it("differs between categories for the same signal id", () => {
    const discarded = generateSyntheticOutcome("sig-1", "discarded");
    const signaled = generateSyntheticOutcome("sig-1", "signaled");
    expect(discarded).not.toEqual(signaled);
  });

  it("discarded tokens crash hard at 24h most of the time (realistic rug pattern)", () => {
    let severeCrashes = 0;
    const total = 300;
    for (let i = 0; i < total; i++) {
      const outcome = generateSyntheticOutcome(`discard-${i}`, "discarded");
      if (outcome.priceChange24hPct <= -90) severeCrashes++;
    }
    // ~75% di crolli severi per costruzione: tolleranza ampia per non essere flaky
    expect(severeCrashes / total).toBeGreaterThan(0.55);
  });

  it("discarded tokens always end up net negative at 24h", () => {
    for (let i = 0; i < 100; i++) {
      const outcome = generateSyntheticOutcome(`discard-${i}`, "discarded");
      expect(outcome.priceChange24hPct).toBeLessThan(0);
    }
  });

  it("signaled tokens have a mix of positive and negative 24h outcomes", () => {
    const outcomes = Array.from({ length: 200 }, (_, i) =>
      generateSyntheticOutcome(`signal-${i}`, "signaled").priceChange24hPct,
    );
    expect(outcomes.some((v) => v > 0)).toBe(true);
    expect(outcomes.some((v) => v < 0)).toBe(true);
  });
});
