import bs58 from "bs58";
import {
  AddressLookupTableAccount,
  type Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import type { JupiterBuildResponse, JupiterInstruction } from "./jupiter-client.js";

function toTransactionInstruction(ix: JupiterInstruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programId),
    keys: ix.accounts.map((account) => ({
      pubkey: new PublicKey(account.pubkey),
      isSigner: account.isSigner,
      isWritable: account.isWritable,
    })),
    data: Buffer.from(ix.data, "base64"),
  });
}

/**
 * Assembla la VersionedTransaction dalle istruzioni "grezze" restituite da
 * Jupiter /build (Router): a differenza di /order, non torna una transazione
 * già serializzata, tocca a noi comporla (blockhash fresco al momento,
 * CLAUDE.md principio 1).
 */
export async function buildVersionedTransaction(
  connection: Connection,
  payer: string,
  build: JupiterBuildResponse,
): Promise<VersionedTransaction> {
  const lookupTableAccounts: AddressLookupTableAccount[] = [];
  if (build.addressesByLookupTableAddress) {
    for (const tableAddress of Object.keys(build.addressesByLookupTableAddress)) {
      const { value } = await connection.getAddressLookupTable(new PublicKey(tableAddress));
      if (!value) {
        throw new Error(`Address lookup table non trovata: ${tableAddress}`);
      }
      lookupTableAccounts.push(value);
    }
  }

  const instructions = [
    ...build.computeBudgetInstructions.map(toTransactionInstruction),
    ...build.setupInstructions.map(toTransactionInstruction),
    toTransactionInstruction(build.swapInstruction),
    ...(build.cleanupInstruction ? [toTransactionInstruction(build.cleanupInstruction)] : []),
    ...build.otherInstructions.map(toTransactionInstruction),
  ];

  const recentBlockhash = bs58.encode(Buffer.from(build.blockhashWithMetadata.blockhash));

  const message = new TransactionMessage({
    payerKey: new PublicKey(payer),
    recentBlockhash,
    instructions,
  }).compileToV0Message(lookupTableAccounts);

  return new VersionedTransaction(message);
}
