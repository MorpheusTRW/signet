import { JUPITER_BUILD_ENDPOINT } from "../config/jupiter.js";

export interface JupiterInstruction {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string; // base64
}

export interface JupiterBuildResponse {
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction: JupiterInstruction | null;
  otherInstructions: JupiterInstruction[];
  /** Presente solo con forJitoBundle=true; non lo usiamo, ma il campo esiste nella risposta reale. */
  tipInstruction?: JupiterInstruction | null;
  addressesByLookupTableAddress: Record<string, string[]> | null;
  blockhashWithMetadata: {
    blockhash: number[];
    lastValidBlockHeight: number;
  };
}

export interface JupiterBuildParams {
  inputMint: string;
  outputMint: string;
  amountLamports: bigint;
  taker: string;
  slippageBps: number;
  platformFeeBps: number;
  feeAccount: string;
}

export class JupiterBuildError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "JupiterBuildError";
  }
}

/**
 * Router di Jupiter Swap V2 (GET /swap/v2/build): nessuna fee di Jupiter,
 * platformFeeBps/feeAccount sotto il nostro controllo. Vedi
 * src/config/jupiter.ts per le fonti e il perché non usiamo /order+/execute.
 */
export async function buildJupiterSwap(
  baseUrl: string,
  params: JupiterBuildParams,
): Promise<JupiterBuildResponse> {
  const query = new URLSearchParams({
    inputMint: params.inputMint,
    outputMint: params.outputMint,
    amount: params.amountLamports.toString(),
    taker: params.taker,
    slippageBps: String(params.slippageBps),
  });
  if (params.platformFeeBps > 0) {
    query.set("platformFeeBps", String(params.platformFeeBps));
    query.set("feeAccount", params.feeAccount);
  }

  const response = await fetch(`${baseUrl}${JUPITER_BUILD_ENDPOINT}?${query.toString()}`);
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new JupiterBuildError(`Jupiter /build -> ${response.status}: ${body}`, response.status);
  }

  return (await response.json()) as JupiterBuildResponse;
}
