import type { SourceProgram } from "@seeker-signal/shared";

/** Storico del wallet dev, come ricostruito dall'ingest (analisi on-chain o dati sintetici). */
export interface DevWalletHistory {
  previousLaunches: number;
  previousRugs: number;
  walletAgeDays: number;
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
  unverified?: ("dev-history" | "snipes")[];
}

/** Interfaccia comune per gli adapter di ingest (synthetic, helius-ws, yellowstone-grpc). */
export interface EventSource {
  start(onEvent: (event: RawLaunchEvent) => void): Promise<void> | void;
  stop(): Promise<void> | void;
}
