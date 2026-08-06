export function testDbUrl(): string {
  if (process.env['DATABASE_URL_TEST']) return process.env['DATABASE_URL_TEST'];
  const base = process.env['DATABASE_URL'] ?? 'postgres://slang:slang@localhost:5802/slang';
  return `${base}_test`;
}
