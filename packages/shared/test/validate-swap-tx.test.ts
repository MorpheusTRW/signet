import { Keypair, SystemProgram } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import { validateSwapTx } from "../src/validate-swap-tx.js";
import {
  FEE_ACCOUNT,
  JUPITER_PROGRAM_ID,
  UNKNOWN_PROGRAM_ID,
  USER,
  buildTx,
  foreignTransferInstruction,
  jupiterSwapInstruction,
  makeFakeConnection,
  wrapSolInstruction,
} from "./validate-swap-tx-fixtures.js";

const ONE_SOL_LAMPORTS = 1_000_000_000;

const BASE_OPTIONS = {
  userPubkey: USER.toBase58(),
  maxSol: 2,
  allowedPrograms: [JUPITER_PROGRAM_ID.toBase58(), SystemProgram.programId.toBase58()],
  expectedFeeAccount: FEE_ACCOUNT.toBase58(),
  maxFeeBps: 75,
};

describe("validateSwapTx", () => {
  it("accepts a well-formed swap tx within cap and fee limits", async () => {
    const tx = buildTx({
      instructions: [wrapSolInstruction(ONE_SOL_LAMPORTS), jupiterSwapInstruction({})],
    });
    const connection = makeFakeConnection({
      preFeeBalance: 0n,
      postFeeBalance: BigInt(Math.round(ONE_SOL_LAMPORTS * 0.005)), // 50 bps
    });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result).toEqual({ valid: true });
  });

  it("rejects a fee payer different from the user", async () => {
    const otherPayer = Keypair.generate().publicKey;
    const tx = buildTx({
      payer: otherPayer,
      instructions: [wrapSolInstruction(ONE_SOL_LAMPORTS), jupiterSwapInstruction({})],
    });
    const connection = makeFakeConnection({ preFeeBalance: 0n, postFeeBalance: 0n });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result).toEqual({ valid: false, reason: "fee_payer_mismatch" });
  });

  it("rejects a program not in the allowlist", async () => {
    const tx = buildTx({
      instructions: [
        wrapSolInstruction(ONE_SOL_LAMPORTS),
        jupiterSwapInstruction({ programId: UNKNOWN_PROGRAM_ID }),
      ],
    });
    const connection = makeFakeConnection({ preFeeBalance: 0n, postFeeBalance: 0n });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("program_not_allowed");
    }
  });

  it("rejects a transfer to an unknown/foreign destination", async () => {
    const tx = buildTx({
      instructions: [
        wrapSolInstruction(ONE_SOL_LAMPORTS),
        foreignTransferInstruction(ONE_SOL_LAMPORTS),
        jupiterSwapInstruction({}),
      ],
    });
    const connection = makeFakeConnection({ preFeeBalance: 0n, postFeeBalance: 0n });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toContain("unknown_transfer_destination");
    }
  });

  it("rejects an amount beyond the approved cap", async () => {
    const tenSol = ONE_SOL_LAMPORTS * 10;
    const tx = buildTx({
      instructions: [wrapSolInstruction(tenSol), jupiterSwapInstruction({})],
    });
    const connection = makeFakeConnection({ preFeeBalance: 0n, postFeeBalance: 0n });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, maxSol: 2, connection });
    expect(result).toEqual({ valid: false, reason: "amount_exceeds_cap" });
  });

  it("rejects when the expected fee account is never referenced", async () => {
    const tx = buildTx({
      instructions: [
        wrapSolInstruction(ONE_SOL_LAMPORTS),
        jupiterSwapInstruction({ includeFeeAccount: false }),
      ],
    });
    const connection = makeFakeConnection({ preFeeBalance: 0n, postFeeBalance: 0n });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result).toEqual({ valid: false, reason: "fee_account_mismatch" });
  });

  it("rejects a fee that exceeds maxFeeBps once simulated", async () => {
    const tx = buildTx({
      instructions: [wrapSolInstruction(ONE_SOL_LAMPORTS), jupiterSwapInstruction({})],
    });
    // 200 bps realizzati, ben oltre il cap di 75 bps
    const connection = makeFakeConnection({
      preFeeBalance: 0n,
      postFeeBalance: BigInt(Math.round(ONE_SOL_LAMPORTS * 0.02)),
    });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result).toEqual({ valid: false, reason: "fee_bps_exceeds_cap" });
  });

  it("accounts for a pre-existing fee account balance when computing the realized fee", async () => {
    const tx = buildTx({
      instructions: [wrapSolInstruction(ONE_SOL_LAMPORTS), jupiterSwapInstruction({})],
    });
    const preBalance = 5_000_000n;
    // 40 bps di fee reale sopra il saldo preesistente
    const feeLamports = BigInt(Math.round(ONE_SOL_LAMPORTS * 0.004));
    const connection = makeFakeConnection({
      preFeeBalance: preBalance,
      postFeeBalance: preBalance + feeLamports,
    });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result).toEqual({ valid: true });
  });

  it("rejects when the simulation itself fails", async () => {
    const tx = buildTx({
      instructions: [wrapSolInstruction(ONE_SOL_LAMPORTS), jupiterSwapInstruction({})],
    });
    const connection = makeFakeConnection({
      preFeeBalance: 0n,
      simulateError: { InstructionError: [0, "Custom error"] },
    });

    const result = await validateSwapTx(tx, { ...BASE_OPTIONS, connection });
    expect(result).toEqual({ valid: false, reason: "fee_simulation_failed" });
  });
});
