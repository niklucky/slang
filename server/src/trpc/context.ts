import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { users } from '../db/schema.js';
import { verifyToken } from '../lib/jwt.js';

export interface SessionUser {
  id: number;
  email: string;
  name: string;
}

export interface Context {
  db: Database;
  user: SessionUser | null;
}

/**
 * Resolves the session from the Authorization header. Accepts both
 * `Bearer <token>` and a bare token, which is what the old server spoke.
 */
export async function createContext(
  db: Database,
  authorizationHeader: string | undefined,
): Promise<Context> {
  const header = authorizationHeader ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : header;

  let user: SessionUser | null = null;
  if (token) {
    const userId = await verifyToken(token);
    if (userId !== null) {
      const [row] = await db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (row) user = row;
    }
  }
  return { db, user };
}
