import type { User } from '@prisma/client';
import { error } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { JWT_EXPIRY } from '../../config/constants';
import { checkPassword, cryptPassword } from '../lib/crypt';
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
    return null
  }
  try {
    const result = jwt.verify(token, process.env.JWT_SECRET as string) as JWTPayload
    return result.uid
  } catch (e) {
    throw new Error('auth_token_invalid')
  }
}

export async function authUserByAccessToken(headers: Headers) {
  const uid = getIdFromAccessToken(headers)
  if (!uid) {
    return
  }
  return await prisma.user.findUniqueOrThrow({ where: { id: uid } })
}

export async function login(username: string, password: string) {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      username
    }
  })
  if (!checkPassword(user.password, password)) {
    throw new Error('username_or_password_invalid')
  }

  const accessToken = generateAccessToken({ uid: user.id })
  return { user, accessToken }
}

export async function register(data: User) {
  data.password = cryptPassword(data.password)
  const user = await prisma.user.create({ data })

  const accessToken = generateAccessToken({ uid: user.id })
  return { user, accessToken }

}