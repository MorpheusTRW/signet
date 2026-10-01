import { describe, expect, it } from "vitest";
import { skipLaunchAnalysisReason } from "../../src/filters/prefilter.js";

const ok = { initialLiquiditySol: 85, topHolderPercentages: [10, 8, 5], devWalletAgeDays: 30 };

describe("skipLaunchAnalysisReason (budget Helius solo sui candidati veri)", () => {
  it("analizza una migrazione normale con holder distribuiti e dev con storico", () => {
    expect(skipLaunchAnalysisReason(ok)).toBeNull();
  });
  it("salta le finte migrazioni a bassa liquidità", () => {
    expect(skipLaunchAnalysisReason({ ...ok, initialLiquiditySol: 0.1 })).toBe("abnormal-liquidity");
  });
  it("salta se i top 10 hanno il 65% o più", () => {
    expect(skipLaunchAnalysisReason({ ...ok, topHolderPercentages: [40, 25] })).toBe("top10-very-high");
  });
  it("salta se la distribuzione non è leggibile", () => {
    expect(skipLaunchAnalysisReason({ ...ok, topHolderPercentages: null })).toBe("holders-unverified");
  });
  it("salta se il wallet del dev è stato creato oggi", () => {
    expect(skipLaunchAnalysisReason({ ...ok, devWalletAgeDays: 0 })).toBe("fresh-dev-wallet");
  });
});
