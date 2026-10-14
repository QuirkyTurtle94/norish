import { z } from "zod";

export const parserHealthSchema = z.object({
  status: z.string().optional(),
  recipeScrapersVersion: z.string().optional(),
});

export const healthyResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.object({
    status: z.literal("ok"),
  }),
  redis: z.object({
    status: z.literal("ok"),
  }),
  versions: z.object({
    root: z.string(),
    apps: z.record(z.string(), z.string()),
    packages: z.record(z.string(), z.string()),
    scraper: z.string().optional(),
  }),
  parser: z.object({
    status: z.literal("ok"),
    recipeScrapersVersion: z.string().optional(),
  }),
});

/** The parser as the liveness and readiness checks report it. */
const reportedParserSchema = z.object({
  status: z.string(),
  statusCode: z.number().optional(),
  recipeScrapersVersion: z.string().optional(),
});

export const liveResponseSchema = z.object({
  status: z.literal("ok"),
  parser: reportedParserSchema,
});

export const readyResponseSchema = z.object({
  status: z.literal("ok"),
  db: z.object({ status: z.literal("ok") }),
  redis: z.object({ status: z.literal("ok") }),
  parser: reportedParserSchema,
});
