import { describe, expect, it } from "vitest";
import { checkAuthorities } from "../../src/filters/authorities.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("checkAuthorities", () => {
  it("passes when both authorities are revoked", () => {
    const result = checkAuthorities(
      makeRawLaunchEvent({
        mintAuthorityRevoked: true,
        freezeAuthorityRevoked: true,
      }),
    );
    expect(result.passed).toBe(true);
  });

  it("flags neither authority revoked (obvious rug pattern)", () => {
    const result = checkAuthorities(
      makeRawLaunchEvent({
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(30);
  });

  it("flags mint authority alone not revoked", () => {
    const result = checkAuthorities(
      makeRawLaunchEvent({
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: true,
      }),
    );
    expect(result.passed).toBe(false);
    expect(result.riskPoints).toBe(20);
  });
});
