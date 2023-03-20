import { response } from "../../../../server/lib/response";
import prisma from "../../../../server/prisma";
import { register } from "../../../../server/services/auth";
import type { RequestEvent } from "./$types";

export async function POST({ request }: RequestEvent) {
  const existed = await prisma.user.count()
  if (existed) {
    throw new Error('account_set_up')
  }
  const payload = await request.json();
  const result = await register(payload)

  return response(result, null)
}