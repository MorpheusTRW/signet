import { describe, expect, it, vi } from "vitest";
import { createHolderChecker } from "../../src/entitlements/holder-check.js";
import type { SkrHolderReader } from "../../src/entitlements/skr-holder.js";
import { makeTierConfig } from "./fixtures.js";

const WALLET = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";

describe("createHolderChecker", () => {
  it("is holder when balance+stake meets the configured threshold", async () => {
    const reader: SkrHolderReader = { getTotalSkr: vi.fn().mockResolvedValue(10_000) };
    const checker = createHolderChecker(reader, makeTierConfig(), 600_000);
    expect(await checker.isHolder(WALLET)).toBe(true);
  });

  it("is not holder when below the threshold", async () => {
    const reader: SkrHolderReader = { getTotalSkr: vi.fn().mockResolvedValue(9_999) };
    const checker = createHolderChecker(reader, makeTierConfig(), 600_000);
    expect(await checker.isHolder(WALLET)).toBe(false);
  });

  it("fails closed (not holder) when the balance can't be verified", async () => {
    const reader: SkrHolderReader = { getTotalSkr: vi.fn().mockResolvedValue(null) };
    const checker = createHolderChecker(reader, makeTierConfig(), 600_000);
    expect(await checker.isHolder(WALLET)).toBe(false);
  });

  it("caches the result: the reader is only called once within the ttl", async () => {
    const getTotalSkr = vi.fn().mockResolvedValue(20_000);
    const checker = createHolderChecker(
      { getTotalSkr },
      makeTierConfig(),
      600_000,
    );
    await checker.isHolder(WALLET);
    await checker.isHolder(WALLET);
    await checker.isHolder(WALLET);
    expect(getTotalSkr).toHaveBeenCalledTimes(1);
  });
});
