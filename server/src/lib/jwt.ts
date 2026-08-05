import { SignJWT, jwtVerify } from 'jose';

import { env } from '../env.js';

/** Same lifetime as the old server. */
const EXPIRY = '30d';

function secret(): Uint8Array {
  return new TextEncoder().encode(env.JWT_SECRET);
}

export async function signToken(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secret());
}

/** Returns the user id, or null when the token is missing/invalid/expired. */
export async function verifyToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload['uid'] === 'number' ? (payload['uid'] as number) : null;
  } catch {
    return null;
  }
}
