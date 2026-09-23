import type { EventSource, RawLaunchEvent } from "./event-source.js";
import { generateSyntheticLaunchEvent } from "./synthetic/generate-event.js";
import type { Rng } from "./synthetic/rng.js";

export interface SyntheticEventSourceOptions {
  /** Intervallo medio, in ms, fra due lanci sintetici. */
  intervalMs?: number;
  /** Sorgente di casualità, iniettabile nei test per determinismo. */
  rng?: Rng;
}

/** Adapter EventSource che genera lanci sintetici realistici (default per sviluppo). */
export class SyntheticEventSource implements EventSource {
  private readonly intervalMs: number;
  private readonly rng: Rng;
  private timer: NodeJS.Timeout | undefined;

  constructor(options: SyntheticEventSourceOptions = {}) {
    this.intervalMs = options.intervalMs ?? 8000;
    this.rng = options.rng ?? Math.random;
  }

  start(onEvent: (event: RawLaunchEvent) => void): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      onEvent(generateSyntheticLaunchEvent(this.rng));
    }, this.intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }
}
