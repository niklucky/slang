import { generateAccessToken } from "../../../../library/jwt";
import { response } from "../../../../server/lib/response";
import prisma from "../../../../server/prisma";
import type { RequestEvent } from "./$types";

export async function POST({ request }: RequestEvent) {
  const payload = await request.json();
  const user = await prisma.user.findFirstOrThrow({
    where: {
      username: payload.username
    }
  })


  const accessToken = generateAccessToken({ uid: user.id })
  return response({ user, accessToken }, null)
}