import { TtlCache } from "./cache.js";
import type { SkrHolderReader } from "./skr-holder.js";
import type { TierConfig } from "./types.js";

export interface HolderChecker {
  isHolder(walletPubkey: string): Promise<boolean>;
}

/** Verifica HOLDER (saldo + stake SKR >= soglia), cache del risultato per `cacheTtlMs`. */
export function createHolderChecker(
  reader: SkrHolderReader,
  tierConfig: TierConfig,
  cacheTtlMs: number,
): HolderChecker {
  const cache = new TtlCache<boolean>(cacheTtlMs);
  return {
    async isHolder(walletPubkey: string) {
      const cached = cache.get(walletPubkey);
      if (cached !== undefined) return cached;

      const totalSkr = await reader.getTotalSkr(walletPubkey);
      const isHolder =
        totalSkr !== null && totalSkr >= tierConfig.holder.minSkrBalance;
      cache.set(walletPubkey, isHolder);
      return isHolder;
    },
  };
}
