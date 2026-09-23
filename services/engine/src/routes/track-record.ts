import type { FastifyInstance } from "fastify";
import type { TrackRecordsRepo } from "../db/track-records-repo.js";
import { computeTrackRecordStats } from "../track-record/aggregate.js";
import { settleDueTrackRecords } from "../track-record/settle.js";

export function registerTrackRecordRoutes(
  app: FastifyInstance,
  trackRecordsRepo: TrackRecordsRepo,
): void {
  app.get("/track-record", async () => {
    settleDueTrackRecords(trackRecordsRepo);
    return computeTrackRecordStats(trackRecordsRepo.list());
  });
}
