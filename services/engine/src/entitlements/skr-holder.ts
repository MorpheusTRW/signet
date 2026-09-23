import { getMint } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import {
  SHARE_PRICE_SCALE,
  SKR_MINT,
  SKR_STAKE_CONFIG_ADDRESS,
  SKR_STAKING_PROGRAM_ID,
  USER_STAKE_DISCRIMINATOR,
} from "../config/skr.js";

// --- Decodifica pura (nessuna rete), vedi src/config/skr.ts per le fonti ---

const DISCRIMINATOR_LEN = 8;

/** Offset di `shares` (u128) in UserStake: disc(8) + bump(1) + stake_config(32) + user(32) + guardian_pool(32). */
const USER_STAKE_SHARES_OFFSET = DISCRIMINATOR_LEN + 1 + 32 + 32 + 32;
/** Offset di `user` (pubkey) in UserStake, usato per il filtro memcmp. */
export const USER_STAKE_USER_OFFSET = DISCRIMINATOR_LEN + 1 + 32;

/** Offset di `share_price` (u128) in StakeConfig: disc(8)+bump(1)+authority(32)+mint(32)+stake_vault(32)+min_stake_amount(8)+cooldown_seconds(8)+total_shares(16). */
const STAKE_CONFIG_SHARE_PRICE_OFFSET =
  DISCRIMINATOR_LEN + 1 + 32 + 32 + 32 + 8 + 8 + 16;

function readU128LE(data: Buffer, offset: number): bigint {
  let value = 0n;
  for (let i = 15; i >= 0; i--) {
    value = (value << 8n) | BigInt(data[offset + i] ?? 0);
  }
  return value;
}

export function decodeUserStakeShares(data: Buffer): bigint {
  return readU128LE(data, USER_STAKE_SHARES_OFFSET);
}

export function decodeStakeConfigSharePrice(data: Buffer): bigint {
  return readU128LE(data, STAKE_CONFIG_SHARE_PRICE_OFFSET);
}

/** shares -> unità raw del token (stessa scala della mint, prima della conversione decimali). */
export function sharesToRawTokens(shares: bigint, sharePrice: bigint): bigint {
  return (shares * sharePrice) / SHARE_PRICE_SCALE;
}

export function rawTokensToUi(rawTokens: bigint, decimals: number): number {
  return Number(rawTokens) / 10 ** decimals;
}

// --- Lettura on-chain (RPC) ---

export interface SkrHolderReader {
  /**
   * Saldo SKR totale (wallet + stake) in unità intere di token.
   * Ritorna null se non verificabile (RPC non raggiungibile, pubkey invalida, ecc).
   */
  getTotalSkr(walletPubkey: string): Promise<number | null>;
}

export function createSkrHolderReader(connection: Connection): SkrHolderReader {
  const skrMint = new PublicKey(SKR_MINT);
  const stakingProgramId = new PublicKey(SKR_STAKING_PROGRAM_ID);
  const stakeConfigAddress = new PublicKey(SKR_STAKE_CONFIG_ADDRESS);
  const discriminatorBase58 = bs58.encode(USER_STAKE_DISCRIMINATOR);

  let decimalsPromise: Promise<number> | undefined;
  function getDecimals(): Promise<number> {
    decimalsPromise ??= getMint(connection, skrMint).then((m) => m.decimals);
    return decimalsPromise;
  }

  async function getWalletBalanceRaw(owner: PublicKey): Promise<bigint> {
    const accounts = await connection.getParsedTokenAccountsByOwner(owner, {
      mint: skrMint,
    });
    return accounts.value.reduce((sum, { account }) => {
      const parsed = account.data.parsed as {
        info?: { tokenAmount?: { amount?: string } };
      };
      const amount = parsed.info?.tokenAmount?.amount;
      return sum + BigInt(amount ?? "0");
    }, 0n);
  }

  async function getStakedRawTokens(owner: PublicKey): Promise<bigint> {
    const [userStakeAccounts, stakeConfigAccount] = await Promise.all([
      connection.getProgramAccounts(stakingProgramId, {
        filters: [
          { memcmp: { offset: 0, bytes: discriminatorBase58 } },
          { memcmp: { offset: USER_STAKE_USER_OFFSET, bytes: owner.toBase58() } },
        ],
      }),
      connection.getAccountInfo(stakeConfigAddress),
    ]);

    if (!stakeConfigAccount) return 0n;
    const sharePrice = decodeStakeConfigSharePrice(stakeConfigAccount.data);
    const totalShares = userStakeAccounts.reduce(
      (sum, { account }) => sum + decodeUserStakeShares(account.data),
      0n,
    );
    return sharesToRawTokens(totalShares, sharePrice);
  }

  return {
    async getTotalSkr(walletPubkey) {
      try {
        const owner = new PublicKey(walletPubkey);
        const [balanceRaw, stakedRaw, decimals] = await Promise.all([
          getWalletBalanceRaw(owner),
          getStakedRawTokens(owner),
          getDecimals(),
        ]);
        return rawTokensToUi(balanceRaw + stakedRaw, decimals);
      } catch {
        return null;
      }
    },
  };
}

/** Connessione non configurata (SOLANA_RPC_URL assente): fail-closed, mai HOLDER. */
export const NULL_SKR_HOLDER_READER: SkrHolderReader = {
  async getTotalSkr() {
    return null;
  },
};
