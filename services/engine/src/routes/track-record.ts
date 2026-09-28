import type { FastifyInstance } from "fastify";
import type { TrackRecordSource, TrackRecordsRepo } from "../db/track-records-repo.js";
import { computeTrackRecordStats } from "../track-record/aggregate.js";
import { settleDueTrackRecords } from "../track-record/settle.js";

export function registerTrackRecordRoutes(
  app: FastifyInstance,
  trackRecordsRepo: TrackRecordsRepo,
  source: TrackRecordSource = "synthetic",
): void {
  app.get("/track-record", async () => {
    // Le marcature reali le realizza il settler periodico (prezzi dalla pool); qui solo le simulate.
    if (source === "synthetic") settleDueTrackRecords(trackRecordsRepo);
    return { source, ...computeTrackRecordStats(trackRecordsRepo.list(source)) };
  });
}
