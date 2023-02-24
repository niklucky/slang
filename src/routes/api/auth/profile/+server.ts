import { requiredAuth } from "../../../../library/jwt";
import { response } from "../../../../server/lib/response";
import prisma from "../../../../server/prisma";
import type { RequestEvent } from "./$types";

export async function GET({ request }: RequestEvent) {
  const id = requiredAuth(request.headers)
  const user = await prisma.user.findFirstOrThrow({ where: { id } })
  return response(user, null)
}