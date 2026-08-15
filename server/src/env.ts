import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().default('postgres://slang:slang@localhost:5802/slang'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be set (openssl rand -hex 32)'),
  PORT: z.coerce.number().int().positive().default(5801),
  /** Directory of the built web UI to serve. Skips static hosting when absent. */
  WEB_DIST: z.string().optional(),
  /** Resend API key. Emails are skipped (with a warning) when absent. */
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  /** Base URL used in emailed links. */
  PUBLIC_URL: z.string().optional(),
});

export const env = envSchema.parse(process.env);
