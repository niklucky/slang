import jwt from 'jsonwebtoken';
import { JWT_EXPIRY } from '../config/constants';

export type JWTPayload = {
  uid: number
}

export function generateAccessToken(payload: JWTPayload) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: JWT_EXPIRY });
}

export function requiredAuth(headers: Headers) {
  const token = headers.get('authorization')
  if (!token) {
    throw new Error('auth_token_invalid')
  }
  const result = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload

  return result.uid
}