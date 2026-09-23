import { signalSchema } from "@seeker-signal/shared";
import { describe, expect, it } from "vitest";
import { buildSignal } from "../../src/signals/build-signal.js";
import { makeRawLaunchEvent } from "../fixtures.js";

describe("buildSignal", () => {
  it("produces a Signal that validates against the shared schema", () => {
    const signal = buildSignal(makeRawLaunchEvent());
    expect(signalSchema.safeParse(signal).success).toBe(true);
  });

  it("carries through program, mint and pool address", () => {
    const event = makeRawLaunchEvent({ program: "pumpswap" });
    const signal = buildSignal(event);
    expect(signal.program).toBe("pumpswap");
    expect(signal.tokenMint).toBe(event.tokenMint);
    expect(signal.poolAddress).toBe(event.poolAddress);
  });

  it("assigns a fresh id on every call", () => {
    const event = makeRawLaunchEvent();
    const a = buildSignal(event);
    const b = buildSignal(event);
    expect(a.id).not.toBe(b.id);
  });
});
