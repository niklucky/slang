import { generateAccessToken } from "../../../../library/jwt";
import { response } from "../../../../server/lib/response";
import prisma from "../../../../server/prisma";
import type { RequestEvent } from "./$types";

export async function POST({ request }: RequestEvent) {
  const existed = await prisma.user.count()
  if (existed) {
    throw new Error('Account is set up')
  }
  const payload = await request.json();
  const user = await prisma.user.create({ data: payload })

  const accessToken = generateAccessToken({ uid: user.id })
  return response({ user, accessToken }, null)
}