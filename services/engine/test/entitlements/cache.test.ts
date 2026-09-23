import { describe, expect, it } from "vitest";
import { TtlCache } from "../../src/entitlements/cache.js";

describe("TtlCache", () => {
  it("returns undefined for a missing key", () => {
    const cache = new TtlCache<number>(1000);
    expect(cache.get("missing")).toBeUndefined();
  });

  it("returns the value before it expires", () => {
    const cache = new TtlCache<number>(10_000);
    cache.set("a", 42, 0);
    expect(cache.get("a", 5000)).toBe(42);
  });

  it("expires after the configured ttl", () => {
    const cache = new TtlCache<number>(10_000);
    cache.set("a", 42, 0);
    expect(cache.get("a", 10_001)).toBeUndefined();
  });

  it("is exactly stale at expiresAt (>=)", () => {
    const cache = new TtlCache<number>(10_000);
    cache.set("a", 42, 0);
    expect(cache.get("a", 10_000)).toBeUndefined();
  });
});
