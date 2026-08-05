import postgres from 'postgres';

import { createDb } from '../src/db/client.js';
import { runMigrations, seedLocales } from '../src/db/migrate.js';
import { testDbUrl } from './db-url.js';

/** Recreate the test database from scratch once per test run. */
export default async function setup(): Promise<void> {
  const url = testDbUrl();
  const dbName = url.split('/').pop() ?? 'slang_test';
  const adminUrl = url.slice(0, url.lastIndexOf('/') + 1) + 'postgres';

  const admin = postgres(adminUrl, { max: 1 });
  await admin.unsafe(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
  await admin.unsafe(`CREATE DATABASE "${dbName}"`);
  await admin.end({ timeout: 5 });

  const handle = createDb(url);
  try {
    await runMigrations(handle.db);
    await seedLocales(handle.db);
  } finally {
    await handle.close();
  }
}
