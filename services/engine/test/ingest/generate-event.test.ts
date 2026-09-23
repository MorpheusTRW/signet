import { signalSchema } from "@seeker-signal/shared";
import { describe, expect, it } from "vitest";
import { generateSyntheticLaunchEvent } from "../../src/ingest/synthetic/generate-event.js";
import { mulberry32 } from "../../src/ingest/synthetic/rng.js";
import { buildSignal } from "../../src/signals/build-signal.js";

describe("generateSyntheticLaunchEvent", () => {
  it("is deterministic for a given rng seed", () => {
    const now = new Date("2026-09-23T10:00:00.000Z");
    const a = generateSyntheticLaunchEvent(mulberry32(42), now);
    const b = generateSyntheticLaunchEvent(mulberry32(42), now);
    expect(a).toEqual(b);
  });

  it("produces events that build into valid Signals", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 50; i++) {
      const event = generateSyntheticLaunchEvent(rng);
      const signal = buildSignal(event);
      expect(signalSchema.safeParse(signal).success).toBe(true);
    }
  });

  it("generates a mix of risk levels across many draws, including obvious rugs", () => {
    const rng = mulberry32(123);
    const levels = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const event = generateSyntheticLaunchEvent(rng);
      const signal = buildSignal(event);
      levels.add(signal.riskReport.level);
    }
    expect(levels.has("low")).toBe(true);
    expect(levels.has("high")).toBe(true);
  });
});
