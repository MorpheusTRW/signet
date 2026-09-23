import { MONITORED_PROGRAMS } from "../../config/programs.js";
import type { RawLaunchEvent } from "../event-source.js";
import type { Rng } from "./rng.js";

const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function randomBase58(rng: Rng, length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += BASE58_ALPHABET[Math.floor(rng() * BASE58_ALPHABET.length)];
  }
  return out;
}

function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

function randInt(rng: Rng, min: number, max: number): number {
  return Math.floor(randRange(rng, min, max + 1));
}

function pick<T>(rng: Rng, items: readonly T[]): T {
  const item = items[Math.floor(rng() * items.length)];
  if (item === undefined) {
    throw new Error("pick: lista vuota");
  }
  return item;
}

/** Distribuisce `total` punti percentuali fra `count` holder, ordinati in modo decrescente. */
function distributeHolderPercentages(
  rng: Rng,
  total: number,
  count = 10,
): number[] {
  const weights = Array.from({ length: count }, () => rng() + 0.05);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  return weights
    .map((w) => Number(((w / weightSum) * total).toFixed(2)))
    .sort((a, b) => b - a);
}

const MEME_WORDS = [
  "Moon",
  "Doge",
  "Pepe",
  "Based",
  "Giga",
  "Chad",
  "Frog",
  "Rocket",
  "Laser",
  "Turbo",
  "Solana",
  "Ratio",
] as const;

type LaunchArchetype = "clean" | "medium" | "rug";

interface ArchetypeProfile {
  weight: number;
  topHoldersTotalPct: [number, number];
  liquiditySol: [number, number];
  snipedWallets: [number, number];
  devPreviousLaunches: [number, number];
  devPreviousRugs: [number, number];
  devWalletAgeDays: [number, number];
  authorityRevokedProbability: number;
}

// Profili usati per generare lanci sintetici realistici, inclusi rug evidenti,
// così da avere segnale sufficiente per esercitare i filtri (F1 punto 1).
const ARCHETYPES: Record<LaunchArchetype, ArchetypeProfile> = {
  clean: {
    weight: 0.5,
    topHoldersTotalPct: [10, 35],
    liquiditySol: [5, 50],
    snipedWallets: [0, 3],
    devPreviousLaunches: [0, 5],
    devPreviousRugs: [0, 0],
    devWalletAgeDays: [30, 500],
    authorityRevokedProbability: 0.95,
  },
  medium: {
    weight: 0.3,
    topHoldersTotalPct: [35, 60],
    liquiditySol: [1, 10],
    snipedWallets: [3, 12],
    devPreviousLaunches: [1, 10],
    devPreviousRugs: [0, 1],
    devWalletAgeDays: [5, 60],
    authorityRevokedProbability: 0.5,
  },
  rug: {
    weight: 0.2,
    topHoldersTotalPct: [60, 97],
    liquiditySol: [0.1, 2],
    snipedWallets: [15, 60],
    devPreviousLaunches: [5, 30],
    devPreviousRugs: [2, 15],
    devWalletAgeDays: [0, 3],
    authorityRevokedProbability: 0.05,
  },
};

function pickArchetype(rng: Rng): LaunchArchetype {
  const entries = Object.entries(ARCHETYPES) as [
    LaunchArchetype,
    ArchetypeProfile,
  ][];
  const roll = rng();
  let cumulative = 0;
  for (const [name, profile] of entries) {
    cumulative += profile.weight;
    if (roll <= cumulative) return name;
  }
  return entries[entries.length - 1]![0];
}

export function generateSyntheticLaunchEvent(
  rng: Rng,
  now: Date = new Date(),
): RawLaunchEvent {
  const archetype = pickArchetype(rng);
  const profile = ARCHETYPES[archetype];

  const word1 = pick(rng, MEME_WORDS);
  const word2 = pick(rng, MEME_WORDS);

  return {
    id: `synthetic_${randomBase58(rng, 20)}`,
    program: pick(rng, MONITORED_PROGRAMS),
    tokenMint: randomBase58(rng, 44),
    poolAddress: randomBase58(rng, 44),
    tokenSymbol: `${word1}${word2}`.toUpperCase().slice(0, 10),
    tokenName: `${word1} ${word2}`,
    createdAt: now.toISOString(),
    initialLiquiditySol: Number(
      randRange(rng, ...profile.liquiditySol).toFixed(3),
    ),
    topHolderPercentages: distributeHolderPercentages(
      rng,
      randRange(rng, ...profile.topHoldersTotalPct),
    ),
    devWalletHistory: {
      previousLaunches: randInt(rng, ...profile.devPreviousLaunches),
      previousRugs: randInt(rng, ...profile.devPreviousRugs),
      walletAgeDays: randInt(rng, ...profile.devWalletAgeDays),
    },
    snipedWalletsCount: randInt(rng, ...profile.snipedWallets),
    mintAuthorityRevoked: rng() < profile.authorityRevokedProbability,
    freezeAuthorityRevoked: rng() < profile.authorityRevokedProbability,
  };
}
