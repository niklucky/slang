import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { fileURLToPath } from 'node:url';

import catalog from './locales-catalog.js';
import type { Database } from './client.js';
import { locales } from './schema.js';

/** `src/db/` and `dist/db/` sit at the same depth below the package root. */
const migrationsFolder = fileURLToPath(new URL('../../drizzle', import.meta.url));

export async function runMigrations(db: Database): Promise<void> {
  await migrate(db, { migrationsFolder });
}

/** Insert catalog locales that are not in the table yet. Idempotent. */
export async function seedLocales(db: Database): Promise<void> {
  const existing = await db.select({ code: locales.code }).from(locales);
  const have = new Set(existing.map((row) => row.code));
  const missing = catalog.filter((locale) => !have.has(locale.code));
  if (missing.length > 0) {
    await db.insert(locales).values(missing);
  }
}
