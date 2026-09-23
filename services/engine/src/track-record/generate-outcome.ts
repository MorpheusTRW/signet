import { hashStringToSeed, mulberry32, type Rng } from "../ingest/synthetic/rng.js";

export type TrackRecordCategory = "signaled" | "discarded";

interface OutcomeRange {
  min: number;
  max: number;
}

function sample(rng: Rng, range: OutcomeRange): number {
  return range.min + rng() * (range.max - range.min);
}

// Range di moltiplicatore (prezzo a +Nh / prezzo all'entry). I "discarded"
// (rischio alto, filtrati) seguono un pattern rug realistico: possibile
// piccolo pump iniziale, poi crollo quasi sempre severo entro 24h. I
// "signaled" (rischio basso/medio, già passati dai filtri) hanno un esito
// molto più bilanciato, riflettendo la normale volatilità delle memecoin.
const DISCARDED_1H: OutcomeRange = { min: 0.3, max: 1.4 };
const SIGNALED_1H: OutcomeRange = { min: 0.7, max: 1.6 };
const DISCARDED_24H_SEVERE: OutcomeRange = { min: 0.01, max: 0.1 };
const DISCARDED_24H_MODERATE: OutcomeRange = { min: 0.1, max: 0.6 };
const SIGNALED_24H: OutcomeRange = { min: 0.3, max: 4.0 };
const SEVERE_CRASH_PROBABILITY = 0.75;

function sampleDiscarded24h(rng: Rng): number {
  return rng() < SEVERE_CRASH_PROBABILITY
    ? sample(rng, DISCARDED_24H_SEVERE)
    : sample(rng, DISCARDED_24H_MODERATE);
}

export interface PriceOutcome {
  priceChange1hPct: number;
  priceChange24hPct: number;
}

/**
 * Genera un esito sintetico realistico per un token, deterministico rispetto
 * a `signalId` + categoria (stesso segnale -> stesso esito, riproducibile nei
 * test). Sostituisce una lettura di prezzo reale, non disponibile in
 * synthetic mode.
 */
export function generateSyntheticOutcome(
  signalId: string,
  category: TrackRecordCategory,
): PriceOutcome {
  const rng = mulberry32(hashStringToSeed(`track-record:${category}:${signalId}`));

  const multiplier1h = sample(rng, category === "discarded" ? DISCARDED_1H : SIGNALED_1H);
  const multiplier24h =
    category === "discarded" ? sampleDiscarded24h(rng) : sample(rng, SIGNALED_24H);

  return {
    priceChange1hPct: Number(((multiplier1h - 1) * 100).toFixed(2)),
    priceChange24hPct: Number(((multiplier24h - 1) * 100).toFixed(2)),
  };
}
