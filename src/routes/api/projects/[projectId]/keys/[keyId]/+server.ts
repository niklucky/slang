import { PrismaClient } from "@prisma/client";
import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../../../server/lib/response";


const prisma = new PrismaClient()

export async function GET({ params }: RequestEvent) {
  if (!params.keyId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.keyId)
  const key = await prisma.key.findUnique({ where: { id } })
  return response(key, null)
}

export async function PUT({ request, params }: RequestEvent) {
  if (!params.keyId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.keyId)
  const data = await request.json()
  console.log('data', data);
  const key = await prisma.key.update({ where: { id }, data })
  return response(key, null)
}