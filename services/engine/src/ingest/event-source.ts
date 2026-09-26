import type { SourceProgram } from "@seeker-signal/shared";

/** Storico del wallet dev, come ricostruito dall'ingest (analisi on-chain o dati sintetici). */
export interface DevWalletHistory {
  /** Lanci precedenti trovati (con l'adapter on-chain è un minimo, non un conteggio completo). */
  previousLaunches: number;
  /** Quanti dei lanci trovati sono migrati fuori dalla bonding curve; undefined se non letto. */
  previousLaunchesMigrated?: number;
  previousRugs: number;
  walletAgeDays: number;
}

/**
 * - dev-launches: lanci precedenti del dev non letti
 * - dev-rugs: quanti lanci precedenti erano rug (non ricostruibile in modo affidabile)
 * - snipes: acquisti nei primi blocchi non letti
 * - holders: distribuzione dei top holder non letta
 */
export type UnverifiedAspect = "dev-launches" | "dev-rugs" | "snipes" | "holders";

/** Come è avvenuto il lancio su pump.fun (dalle prime tx della bonding curve). */
export interface LaunchPattern {
  /** Minuti fra la creazione del token e la migrazione. */
  minutesToMigrate: number;
  /** Wallet (escluso il dev) che comprano nello stesso slot della creazione, e la loro % di supply. */
  bundleWallets: number;
  bundlePct: number;
  /** % supply comprata dal dev nello slot di creazione. */
  devBuyPct: number;
  /** % supply comprata dagli sniper nei primi blocchi. */
  snipersPct: number;
  /** Acquirenti iniziali con le fee pagate da un altro wallet (stesso operatore). */
  linkedWallets: number;
  /** Minuti fra la prima attività del wallet dev e il lancio; null se sconosciuto. */
  devFundedMinutesBeforeLaunch: number | null;
}

/** Evento di lancio grezzo prodotto da un adapter di ingest, prima dei filtri. */
export interface RawLaunchEvent {
  id: string;
  program: SourceProgram;
  tokenMint: string;
  poolAddress: string;
  tokenSymbol?: string;
  tokenName?: string;
  createdAt: string;
  initialLiquiditySol: number;
  /** % di supply per ciascuno dei top holder, ordinate in modo decrescente. */
  topHolderPercentages: number[];
  devWalletHistory: DevWalletHistory;
  /** Numero di wallet che hanno comprato nei primi blocchi dopo il lancio. */
  snipedWalletsCount: number;
  mintAuthorityRevoked: boolean;
  freezeAuthorityRevoked: boolean;
  /**
   * Aspetti che l'adapter NON ha potuto verificare (es. lo storico dei rug del
   * dev o gli snipe richiedono analisi non ancora implementate): i filtri non
   * devono presentarli come "puliti".
   */
  unverified?: UnverifiedAspect[];
  /** true se l'evento è una migrazione pump.fun → PumpSwap reale (liquidità attesa ~85 SOL). */
  pumpMigration?: boolean;
  launch?: LaunchPattern;
}

/** Interfaccia comune per gli adapter di ingest (synthetic, helius-ws, yellowstone-grpc). */
export interface EventSource {
  start(onEvent: (event: RawLaunchEvent) => void): Promise<void> | void;
  stop(): Promise<void> | void;
}
