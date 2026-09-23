import { z } from "zod";

export const riskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof riskLevelSchema>;

export const riskReportSchema = z.object({
  score: z.number().min(0).max(100),
  level: riskLevelSchema,
  reasons: z.array(z.string()).min(1),
});

export type RiskReport = z.infer<typeof riskReportSchema>;
