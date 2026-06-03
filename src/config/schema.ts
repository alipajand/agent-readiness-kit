import { z } from 'zod';

export const auditOptionsSchema = z.object({
  repoPath: z.string().min(1).optional(),
  json: z.boolean().optional(),
  output: z.string().min(1).optional(),
});

export type AuditOptionsInput = z.infer<typeof auditOptionsSchema>;

export const initOptionsSchema = z.object({
  force: z.boolean().optional(),
  repoPath: z.string().min(1).optional(),
});

export const generateOptionsSchema = z.object({
  force: z.boolean().optional(),
  repoPath: z.string().min(1).optional(),
});

/** Optional repo-level config file (`.arkrc` JSON). CLI flags override these values. */
export const arkrcSchema = z.object({
  audit: auditOptionsSchema.optional(),
  init: initOptionsSchema.optional(),
  generate: generateOptionsSchema.optional(),
});

export type ArkRc = z.infer<typeof arkrcSchema>;
