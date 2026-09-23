import { AccountLayout, getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type Connection,
} from "@solana/web3.js";

export const USER = Keypair.generate().publicKey;
export const FEE_ACCOUNT = Keypair.generate().publicKey;
export const JUPITER_PROGRAM_ID = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
export const UNKNOWN_PROGRAM_ID = Keypair.generate().publicKey;
export const DUMMY_BLOCKHASH = Keypair.generate().publicKey.toBase58();

export const USER_WSOL_ATA = getAssociatedTokenAddressSync(NATIVE_MINT, USER);

export function wrapSolInstruction(lamports: number): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: USER,
    toPubkey: USER_WSOL_ATA,
    lamports,
  });
}

export function foreignTransferInstruction(lamports: number): TransactionInstruction {
  return SystemProgram.transfer({
    fromPubkey: USER,
    toPubkey: Keypair.generate().publicKey,
    lamports,
  });
}

export function jupiterSwapInstruction(opts: {
  programId?: PublicKey;
  includeFeeAccount?: boolean;
}): TransactionInstruction {
  const keys = [
    { pubkey: USER, isSigner: true, isWritable: true },
    { pubkey: USER_WSOL_ATA, isSigner: false, isWritable: true },
  ];
  if (opts.includeFeeAccount ?? true) {
    keys.push({ pubkey: FEE_ACCOUNT, isSigner: false, isWritable: true });
  }
  return new TransactionInstruction({
    programId: opts.programId ?? JUPITER_PROGRAM_ID,
    keys,
    data: Buffer.from([1, 2, 3, 4]),
  });
}

export function buildTx(params: {
  payer?: PublicKey;
  instructions: TransactionInstruction[];
}): VersionedTransaction {
  const message = new TransactionMessage({
    payerKey: params.payer ?? USER,
    recentBlockhash: DUMMY_BLOCKHASH,
    instructions: params.instructions,
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

function encodeTokenAccount(amount: bigint): Buffer {
  const buf = Buffer.alloc(AccountLayout.span);
  AccountLayout.encode(
    {
      mint: NATIVE_MINT,
      owner: PublicKey.default,
      amount,
      delegateOption: 0,
      delegate: PublicKey.default,
      state: 1,
      isNativeOption: 0,
      isNative: 0n,
      delegatedAmount: 0n,
      closeAuthorityOption: 0,
      closeAuthority: PublicKey.default,
    },
    buf,
  );
  return buf;
}

/** Connection fittizia: nessuna ALT, saldo pre/post di `feeAccount` controllabile. */
export function makeFakeConnection(opts: {
  preFeeBalance?: bigint;
  postFeeBalance?: bigint;
  simulateError?: unknown;
}): Connection {
  return {
    async getAddressLookupTable() {
      return { context: { slot: 0 }, value: null };
    },
    async getTokenAccountBalance() {
      if (opts.preFeeBalance === undefined) {
        throw new Error("account not initialized");
      }
      return {
        context: { slot: 0 },
        value: { amount: opts.preFeeBalance.toString(), decimals: 9, uiAmount: null, uiAmountString: "" },
      };
    },
    async simulateTransaction() {
      if (opts.simulateError) {
        return {
          context: { slot: 0 },
          value: { err: opts.simulateError, logs: null, accounts: null, unitsConsumed: 0, returnData: null },
        };
      }
      const data = encodeTokenAccount(opts.postFeeBalance ?? 0n);
      return {
        context: { slot: 0 },
        value: {
          err: null,
          logs: null,
          unitsConsumed: 0,
          returnData: null,
          accounts: [
            {
              data: [data.toString("base64"), "base64"] as [string, string],
              executable: false,
              lamports: 0,
              owner: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              rentEpoch: 0,
            },
          ],
        },
      };
    },
  } as unknown as Connection;
}
