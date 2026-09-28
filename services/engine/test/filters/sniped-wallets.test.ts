import { describe, expect, it } from "vitest";
import { checkSnipedWallets } from "../../src/filters/sniped-wallets.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("checkSnipedWallets", () => {
  it("passes with no snipers", () => {
    const result = checkSnipedWallets(
      makeRawLaunchEvent({ snipedWalletsCount: 0 }),
    );
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("No snipes detected");
  });

  it("reports a small number of snipers as passed but visible", () => {
    const result = checkSnipedWallets(
      makeRawLaunchEvent({ snipedWalletsCount: 3 }),
    );
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("3 wallets sniped");
  });

  it("flags heavy sniping (obvious rug pattern)", () => {
    const result = checkSnipedWallets(
      makeRawLaunchEvent({ snipedWalletsCount: 40 }),
    );
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(25);
  });
});
