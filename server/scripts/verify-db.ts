import 'dotenv/config';
import { createDb } from '../src/db/client.js';
import { runMigrations, seedLocales } from '../src/db/migrate.js';
import { locales } from '../src/db/schema.js';

const url = process.env['DATABASE_URL'] ?? 'postgres://slang:slang@localhost:5432/slang';
const handle = createDb(url);
await runMigrations(handle.db);
await seedLocales(handle.db);
const count = await handle.db.select({ id: locales.id }).from(locales);
console.log(`migrations applied, locales seeded: ${count.length}`);
await handle.close();
