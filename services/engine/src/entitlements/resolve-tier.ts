import type { SubscriptionsRepo } from "../db/subscriptions-repo.js";
import { getTierLimits } from "./tier-limits.js";
import type { HolderChecker } from "./holder-check.js";
import type { Tier, TierConfig, TierLimits } from "./types.js";

export interface TierResolution {
  tier: Tier;
  /** Scadenza ISO dell'abbonamento PRO attivo, null per free/holder. */
  expiresAt: string | null;
  limits: TierLimits;
}

export interface ResolveTierDeps {
  subscriptionsRepo: SubscriptionsRepo;
  holderChecker: HolderChecker;
  tierConfig: TierConfig;
}

/**
 * HOLDER (SKR in saldo/stake >= soglia) vince su PRO a pagamento: chi detiene
 * SKR ottiene PRO gratis (CLAUDE.md, sezione Monetizzazione). Altrimenti si
 * usa l'abbonamento PRO attivo più recente, se presente; default FREE.
 */
export async function resolveTier(
  walletPubkey: string,
  deps: ResolveTierDeps,
  now: Date = new Date(),
): Promise<TierResolution> {
  const isHolder = await deps.holderChecker.isHolder(walletPubkey);
  if (isHolder) {
    return {
      tier: "holder",
      expiresAt: null,
      limits: getTierLimits("holder", deps.tierConfig),
    };
  }

  const subscription = deps.subscriptionsRepo.findActiveByWallet(
    walletPubkey,
    now,
  );
  if (subscription) {
    return {
      tier: "pro",
      expiresAt: subscription.expiresAt,
      limits: getTierLimits("pro", deps.tierConfig),
    };
  }

  return {
    tier: "free",
    expiresAt: null,
    limits: getTierLimits("free", deps.tierConfig),
  };
}
