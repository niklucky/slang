import type { User } from '@prisma/client';
import { error } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRY } from '../../config/constants';
import prisma from '../prisma';

export type JWTPayload = {
  uid: number
}

export function requireUser(user?: User) {
  if (!user) {
    throw error(401, { message: 'not_authorized' })
  }
  return user
}

export function generateAccessToken(payload: JWTPayload) {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn: JWT_EXPIRY });
}

export function getIdFromAccessToken(headers: Headers) {
  const token = headers.get('authorization')
  if (!token) {
    throw new Error('auth_token_invalid')
  }
  const result = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload

  return result.uid
}

export async function authUserByAccessToken(headers: Headers) {
  const uid = getIdFromAccessToken(headers)
  return await prisma.user.findUniqueOrThrow({ where: { id: uid } })
}