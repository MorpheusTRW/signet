import { getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import { Keypair, type Connection } from "@solana/web3.js";
import { vi } from "vitest";
import { JUPITER_PROGRAM_ID } from "../../src/config/jupiter.js";

export const TAKER = Keypair.generate().publicKey;
export const TREASURY = Keypair.generate().publicKey;
export const TREASURY_FEE_ACCOUNT = getAssociatedTokenAddressSync(NATIVE_MINT, TREASURY);
export const OUTPUT_MINT = Keypair.generate().publicKey;

const DUMMY_BLOCKHASH_BYTES = Array.from({ length: 32 }, (_, i) => (i + 1) % 256);

export function fakeJupiterBuildResponse(overrides: Record<string, unknown> = {}) {
  return {
    inAmount: "500000000",
    outAmount: "123456789",
    otherAmountThreshold: "123000000",
    priceImpactPct: "0.0123",
    computeBudgetInstructions: [],
    setupInstructions: [],
    swapInstruction: {
      programId: JUPITER_PROGRAM_ID,
      accounts: [
        { pubkey: TAKER.toBase58(), isSigner: true, isWritable: true },
        { pubkey: TREASURY_FEE_ACCOUNT.toBase58(), isSigner: false, isWritable: true },
      ],
      data: Buffer.from([9, 9, 9]).toString("base64"),
    },
    cleanupInstruction: null,
    otherInstructions: [],
    addressesByLookupTableAddress: null,
    blockhashWithMetadata: { blockhash: DUMMY_BLOCKHASH_BYTES, lastValidBlockHeight: 999 },
    ...overrides,
  };
}

export function mockFetchOnce(status: number, body: unknown): void {
  const response = new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
}

export function makeFakeConnection(): Connection {
  return {
    async getAddressLookupTable() {
      return { context: { slot: 0 }, value: null };
    },
    async getAccountInfo() {
      return null; // getMint fallisce -> outAmountUi resta null, gestito dal route
    },
  } as unknown as Connection;
}
