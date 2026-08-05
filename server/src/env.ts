import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://slang:slang@localhost:5432/slang'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be set (openssl rand -hex 32)'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Directory of the built web UI to serve. Skips static hosting when absent. */
  WEB_DIST: z.string().optional(),
});

export const env = envSchema.parse(process.env);
