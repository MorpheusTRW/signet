import { PublicKey } from "@solana/web3.js";
import type { RpcCall } from "./rpc.js";

const METAPLEX_METADATA_PROGRAM = new PublicKey("metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s");
const SIGNATURES_PAGE = 1000;
const MAX_SIGNATURE_PAGES = 5;
const SECONDS_PER_DAY = 86_400;

interface ParsedMintInfo {
  mintAuthority: string | null;
  freezeAuthority: string | null;
  supply: string;
  decimals: number;
}

interface ParsedMintAccount {
  value: {
    data: {
      parsed?: {
        info?: ParsedMintInfo & {
          extensions?: { extension: string; state?: { name?: string; symbol?: string } }[];
        };
      };
    };
  } | null;
}

export interface MintInfo {
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  supplyRaw: bigint;
  /** Nome/simbolo se leggibili (estensione Token-2022 o metadata Metaplex), altrimenti undefined. */
  name?: string;
  symbol?: string;
}

export async function fetchMintInfo(rpc: RpcCall, mint: string): Promise<MintInfo | null> {
  const account = await rpc<ParsedMintAccount>("getAccountInfo", [
    mint,
    { encoding: "jsonParsed", commitment: "confirmed" },
  ]);
  const info = account.value?.data.parsed?.info;
  if (!info) return null;

  let name: string | undefined;
  let symbol: string | undefined;
  const ext = info.extensions?.find((e) => e.extension === "tokenMetadata");
  if (ext?.state?.name || ext?.state?.symbol) {
    name = ext.state.name;
    symbol = ext.state.symbol;
  } else {
    const meta = await fetchMetaplexMetadata(rpc, mint).catch(() => undefined);
    name = meta?.name;
    symbol = meta?.symbol;
  }

  return {
    mintAuthorityRevoked: info.mintAuthority === null,
    freezeAuthorityRevoked: info.freezeAuthority === null,
    supplyRaw: BigInt(info.supply),
    ...(name !== undefined && { name }),
    ...(symbol !== undefined && { symbol }),
  };
}

function readBorshString(data: Buffer, offset: number): { value: string; next: number } {
  const length = data.readUInt32LE(offset);
  const value = data
    .subarray(offset + 4, offset + 4 + length)
    .toString("utf8")
    .replace(/\0+$/, "")
    .trim();
  return { value, next: offset + 4 + length };
}

/** Layout Metaplex Token Metadata: key(1) updateAuthority(32) mint(32) name(str) symbol(str). */
async function fetchMetaplexMetadata(
  rpc: RpcCall,
  mint: string,
): Promise<{ name: string; symbol: string } | undefined> {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METAPLEX_METADATA_PROGRAM.toBuffer(), new PublicKey(mint).toBuffer()],
    METAPLEX_METADATA_PROGRAM,
  );
  const account = await rpc<{ value: { data: [string, string] } | null }>("getAccountInfo", [
    pda.toBase58(),
    { encoding: "base64", commitment: "confirmed" },
  ]);
  if (!account.value) return undefined;
  const data = Buffer.from(account.value.data[0], "base64");
  const name = readBorshString(data, 65);
  const symbol = readBorshString(data, name.next);
  return { name: name.value, symbol: symbol.value };
}

/**
 * % di supply dei top holder (max 10, ordinati in modo decrescente), escludendo
 * il vault della pool: subito dopo il lancio detiene la quasi totalità dell'offerta
 * ed è liquidità, non un holder.
 */
export async function fetchTopHolderPercentages(
  rpc: RpcCall,
  mint: string,
  supplyRaw: bigint,
  excludeAccounts: string[],
): Promise<number[]> {
  if (supplyRaw === 0n) return [];
  const largest = await rpc<{ value: { address: string; amount: string }[] }>(
    "getTokenLargestAccounts",
    [mint, { commitment: "confirmed" }],
  );
  return largest.value
    .filter((a) => !excludeAccounts.includes(a.address))
    .slice(0, 10)
    .map((a) => Number((BigInt(a.amount) * 10_000n) / supplyRaw) / 100);
}

/**
 * Età del wallet dev in giorni, dalla firma più vecchia trovata (fino a
 * MAX_SIGNATURE_PAGES*1000 firme: oltre quella soglia il wallet è comunque
 * molto attivo e l'età trovata è un limite inferiore già affidabile).
 * Ritorna 0 se il wallet non ha storico.
 */
export async function fetchWalletAgeDays(
  rpc: RpcCall,
  wallet: string,
  nowSeconds: number,
): Promise<number> {
  let before: string | undefined;
  let oldestBlockTime: number | null | undefined;
  for (let page = 0; page < MAX_SIGNATURE_PAGES; page++) {
    const signatures = await rpc<{ signature: string; blockTime: number | null }[]>(
      "getSignaturesForAddress",
      [wallet, { limit: SIGNATURES_PAGE, commitment: "confirmed", ...(before && { before }) }],
    );
    const last = signatures[signatures.length - 1];
    if (!last) break;
    oldestBlockTime = last.blockTime;
    before = last.signature;
    if (signatures.length < SIGNATURES_PAGE) break;
  }
  if (oldestBlockTime == null) return 0;
  return Math.max(0, Math.floor((nowSeconds - oldestBlockTime) / SECONDS_PER_DAY));
}
