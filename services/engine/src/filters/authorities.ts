import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

/** Mint/freeze authority non revocate: il dev può stampare nuovi token o congelare i wallet. */
export function checkAuthorities(event: RawLaunchEvent): FilterCheck {
  const { mintAuthorityRevoked, freezeAuthorityRevoked } = event;

  if (!mintAuthorityRevoked && !freezeAuthorityRevoked) {
    return {
      id: "authorities",
      passed: false,
      reason: "Mint and freeze authority not revoked",
      riskPoints: 30,
    };
  }

  if (!mintAuthorityRevoked) {
    return {
      id: "authorities",
      passed: false,
      reason: "Mint authority not revoked",
      riskPoints: 20,
    };
  }

  if (!freezeAuthorityRevoked) {
    return {
      id: "authorities",
      passed: false,
      reason: "Freeze authority not revoked",
      riskPoints: 15,
    };
  }

  return {
    id: "authorities",
    passed: true,
    reason: "Mint and freeze authority revoked",
    riskPoints: 0,
  };
}
