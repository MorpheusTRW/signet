import type { RawLaunchEvent } from "../src/ingest/event-source.js";

const VALID_PUBKEY_A = "9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin";
const VALID_PUBKEY_B = "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1";

export function makeRawLaunchEvent(
  overrides: Partial<RawLaunchEvent> = {},
): RawLaunchEvent {
  return {
    id: "evt-1",
    program: "pump-fun",
    tokenMint: VALID_PUBKEY_A,
    poolAddress: VALID_PUBKEY_B,
    tokenSymbol: "TEST",
    tokenName: "Test Token",
    createdAt: "2026-09-23T10:00:00.000Z",
    initialLiquiditySol: 10,
    topHolderPercentages: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3],
    devWalletHistory: {
      previousLaunches: 2,
      previousRugs: 0,
      walletAgeDays: 120,
    },
    snipedWalletsCount: 1,
    mintAuthorityRevoked: true,
    freezeAuthorityRevoked: true,
    ...overrides,
  };
}
