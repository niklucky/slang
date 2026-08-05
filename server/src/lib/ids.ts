import { randomBytes } from 'node:crypto';

/** 64-char hex, crypto-random (the old server used Math.random). */
export function generateApiKey(): string {
  return randomBytes(32).toString('hex');
}
