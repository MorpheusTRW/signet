import type { RawLaunchEvent } from "../ingest/event-source.js";
import type { FilterCheck } from "./types.js";

/** Mint/freeze authority non revocate: il dev può stampare nuovi token o congelare i wallet. */
export function checkAuthorities(event: RawLaunchEvent): FilterCheck {
  const { mintAuthorityRevoked, freezeAuthorityRevoked } = event;

  if (!mintAuthorityRevoked && !freezeAuthorityRevoked) {
    return {
      id: "authorities",
      passed: false,
      reason: "Mint e freeze authority non revocate",
      riskPoints: 30,
    };
  }

  if (!mintAuthorityRevoked) {
    return {
      id: "authorities",
      passed: false,
      reason: "Mint authority non revocata",
      riskPoints: 20,
    };
  }

  if (!freezeAuthorityRevoked) {
    return {
      id: "authorities",
      passed: false,
      reason: "Freeze authority non revocata",
      riskPoints: 15,
    };
  }

  return {
    id: "authorities",
    passed: true,
    reason: "Mint e freeze authority revocate",
    riskPoints: 0,
  };
}
