import { describe, expect, it } from "vitest";
import {
  decodeStakeConfigSharePrice,
  decodeUserStakeShares,
  rawTokensToUi,
  sharesToRawTokens,
  USER_STAKE_USER_OFFSET,
} from "../../src/entitlements/skr-holder.js";

function writeU128LE(buf: Buffer, offset: number, value: bigint): void {
  for (let i = 0; i < 16; i++) {
    buf[offset + i] = Number((value >> BigInt(8 * i)) & 0xffn);
  }
}

// Offset dei campi `shares` (UserStake) e `share_price` (StakeConfig), come
// derivati dall'IDL ufficiale (vedi src/config/skr.ts e src/entitlements/skr-holder.ts).
const USER_STAKE_SHARES_OFFSET = 8 + 1 + 32 + 32 + 32;
const STAKE_CONFIG_SHARE_PRICE_OFFSET = 8 + 1 + 32 + 32 + 32 + 8 + 8 + 16;

describe("decodeUserStakeShares", () => {
  it("decodes a u128 little-endian value at the documented offset", () => {
    const buf = Buffer.alloc(200);
    writeU128LE(buf, USER_STAKE_SHARES_OFFSET, 123_456_789_012_345n);
    expect(decodeUserStakeShares(buf)).toBe(123_456_789_012_345n);
  });

  it("reads 0 for an empty/zeroed buffer", () => {
    const buf = Buffer.alloc(200);
    expect(decodeUserStakeShares(buf)).toBe(0n);
  });
});

describe("decodeStakeConfigSharePrice", () => {
  it("decodes a u128 little-endian value at the documented offset", () => {
    const buf = Buffer.alloc(200);
    writeU128LE(buf, STAKE_CONFIG_SHARE_PRICE_OFFSET, 1_500_000_000n);
    expect(decodeStakeConfigSharePrice(buf)).toBe(1_500_000_000n);
  });
});

describe("USER_STAKE_USER_OFFSET", () => {
  it("matches the disc(8)+bump(1)+stake_config(32) prefix used for the memcmp filter", () => {
    expect(USER_STAKE_USER_OFFSET).toBe(8 + 1 + 32);
  });
});

describe("sharesToRawTokens", () => {
  it("converts shares to raw token units using the global share price", () => {
    // 2e9 shares * 1.5e9 share price / 1e9 scale = 3e9 raw units
    expect(sharesToRawTokens(2_000_000_000n, 1_500_000_000n)).toBe(3_000_000_000n);
  });

  it("returns 0 for 0 shares", () => {
    expect(sharesToRawTokens(0n, 1_500_000_000n)).toBe(0n);
  });
});

describe("rawTokensToUi", () => {
  it("divides by 10^decimals", () => {
    expect(rawTokensToUi(3_000_000_000n, 9)).toBe(3);
    expect(rawTokensToUi(1_500_000n, 6)).toBe(1.5);
  });
});
