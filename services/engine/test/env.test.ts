import { describe, expect, it } from "vitest";
import { loadEnv } from "../src/env.js";

describe("loadEnv", () => {
  it("applies defaults for genuinely absent variables", () => {
    const env = loadEnv({});
    expect(env.JUPITER_API_BASE_URL).toBe("https://api.jup.ag");
    expect(env.TRADING_MODE).toBe("paper");
  });

  it("treats an empty string value the same as absent (applies the default)", () => {
    // .env.example scrive tutte le chiavi opzionali come "KEY=" (vuoto): con
    // --env-file-if-exists questo diventa process.env.KEY === "", non undefined.
    const env = loadEnv({ JUPITER_API_BASE_URL: "" });
    expect(env.JUPITER_API_BASE_URL).toBe("https://api.jup.ag");
  });

  it("still treats an empty optional field as not configured", () => {
    const env = loadEnv({ SOLANA_RPC_URL: "", TREASURY_WALLET_PUBKEY: "" });
    expect(env.SOLANA_RPC_URL).toBeUndefined();
    expect(env.TREASURY_WALLET_PUBKEY).toBeUndefined();
  });

  it("keeps a genuinely provided value", () => {
    const env = loadEnv({ JUPITER_API_BASE_URL: "https://example.test" });
    expect(env.JUPITER_API_BASE_URL).toBe("https://example.test");
  });
});
