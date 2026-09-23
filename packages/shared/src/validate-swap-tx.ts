import { AccountLayout, getAssociatedTokenAddressSync, NATIVE_MINT } from "@solana/spl-token";
import {
  type Connection,
  PublicKey,
  SystemInstruction,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";

export interface ValidateSwapTxOptions {
  /** Pubkey del wallet che deve firmare ed eseguire lo swap. */
  userPubkey: string;
  /** Importo massimo in SOL approvato dall'utente per questa entry. */
  maxSol: number;
  /** Program ID ammessi fra le istruzioni top-level della transazione. */
  allowedPrograms: string[];
  /** Account che deve ricevere la platform fee (ATA wSOL della treasury). */
  expectedFeeAccount: string;
  /** Fee massima accettabile, in basis point. */
  maxFeeBps: number;
  /**
   * Serve a risolvere le address lookup table e a verificare via simulazione
   * la fee realmente incassata (embedded nella swap instruction via CPI, non
   * decodificabile in modo affidabile dai soli byte senza l'IDL di Jupiter).
   */
  connection: Connection;
}

export type ValidateSwapTxResult =
  | { valid: true }
  | { valid: false; reason: string };

function invalid(reason: string): ValidateSwapTxResult {
  return { valid: false, reason };
}

/**
 * Valida una transazione di swap NON firmata prima di passarla a MWA per la
 * firma (CLAUDE.md, principio 2). Rifiuta: fee payer diverso dall'utente,
 * program non in allowlist, transfer SOL verso destinazioni sconosciute,
 * importo oltre il cap approvato, fee verso un account diverso da quello
 * atteso o oltre il limite in bps.
 */
export async function validateSwapTx(
  tx: VersionedTransaction,
  options: ValidateSwapTxOptions,
): Promise<ValidateSwapTxResult> {
  const userPubkey = new PublicKey(options.userPubkey);
  const expectedFeeAccount = new PublicKey(options.expectedFeeAccount);
  const allowedPrograms = new Set(options.allowedPrograms);

  const feePayer = tx.message.staticAccountKeys[0];
  if (!feePayer || !feePayer.equals(userPubkey)) {
    return invalid("fee_payer_mismatch");
  }

  const lookupTableAccounts = await Promise.all(
    tx.message.addressTableLookups.map(async (lookup) => {
      const { value } = await options.connection.getAddressLookupTable(
        lookup.accountKey,
      );
      if (!value) {
        throw new Error(`Address lookup table non trovata: ${lookup.accountKey.toBase58()}`);
      }
      return value;
    }),
  );

  const accountKeys = tx.message.getAccountKeys({ addressLookupTableAccounts: lookupTableAccounts });
  const userWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, userPubkey);

  let feeAccountReferenced = false;
  let solIntoSwapLamports = 0n;

  for (const ix of tx.message.compiledInstructions) {
    const programId = accountKeys.get(ix.programIdIndex);
    if (!programId) {
      return invalid("unresolvable_program");
    }

    if (!allowedPrograms.has(programId.toBase58())) {
      return invalid(`program_not_allowed:${programId.toBase58()}`);
    }

    const keys = ix.accountKeyIndexes.map((index) => {
      const pubkey = accountKeys.get(index);
      if (!pubkey) {
        throw new Error(`Indice account non risolvibile: ${index}`);
      }
      return { pubkey, isSigner: false, isWritable: false };
    });

    if (keys.some((k) => k.pubkey.equals(expectedFeeAccount))) {
      feeAccountReferenced = true;
    }

    if (programId.equals(SystemProgram.programId)) {
      let decoded;
      try {
        decoded = SystemInstruction.decodeTransfer({
          programId,
          keys,
          data: Buffer.from(ix.data),
        });
      } catch {
        continue; // non è un transfer (es. createAccount per wSOL): non ci riguarda qui
      }

      const isKnownDestination =
        decoded.toPubkey.equals(expectedFeeAccount) ||
        decoded.toPubkey.equals(userPubkey) ||
        decoded.toPubkey.equals(userWsolAta);

      if (!isKnownDestination) {
        return invalid(`unknown_transfer_destination:${decoded.toPubkey.toBase58()}`);
      }

      if (decoded.toPubkey.equals(userWsolAta)) {
        solIntoSwapLamports += BigInt(decoded.lamports);
      }
    }
  }

  const maxLamports = BigInt(Math.round(options.maxSol * 1_000_000_000));
  if (solIntoSwapLamports > maxLamports) {
    return invalid("amount_exceeds_cap");
  }

  if (!feeAccountReferenced) {
    return invalid("fee_account_mismatch");
  }

  const feeBpsRealized = await simulateRealizedFeeBps(
    tx,
    options.connection,
    expectedFeeAccount,
    solIntoSwapLamports,
  );
  if (feeBpsRealized === null) {
    return invalid("fee_simulation_failed");
  }
  if (feeBpsRealized > options.maxFeeBps) {
    return invalid("fee_bps_exceeds_cap");
  }

  return { valid: true };
}

async function getTokenBalanceRaw(
  connection: Connection,
  account: PublicKey,
): Promise<bigint> {
  try {
    const { value } = await connection.getTokenAccountBalance(account);
    return BigInt(value.amount);
  } catch {
    return 0n; // account non ancora inizializzato: saldo pre-simulazione 0
  }
}

/**
 * La platform fee è incassata dentro la swap instruction via CPI, non come
 * transfer separato: l'unico modo affidabile di verificarne l'importo reale
 * senza dipendere dal layout interno (non documentato pubblicamente) del
 * programma Jupiter è simulare e confrontare il saldo di `feeAccount` prima
 * e dopo. Ritorna null se la simulazione fallisce o l'importo di input è 0.
 */
async function simulateRealizedFeeBps(
  tx: VersionedTransaction,
  connection: Connection,
  feeAccount: PublicKey,
  inputLamports: bigint,
): Promise<number | null> {
  if (inputLamports === 0n) {
    return null;
  }

  const preBalance = await getTokenBalanceRaw(connection, feeAccount);

  const simulation = await connection.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
    accounts: { encoding: "base64", addresses: [feeAccount.toBase58()] },
  });

  if (simulation.value.err) {
    return null;
  }

  const raw = simulation.value.accounts?.[0];
  const rawBase64 = raw?.data[0];
  if (!rawBase64) {
    return null;
  }

  const data = Buffer.from(rawBase64, "base64");
  const postBalance = AccountLayout.decode(data).amount;

  const feeLamports = postBalance - preBalance;
  if (feeLamports <= 0n) {
    return 0;
  }

  return Number((feeLamports * 10_000n) / inputLamports);
}
