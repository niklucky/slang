import { PrismaClient } from "@prisma/client";
import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../../../server/lib/response";


const prisma = new PrismaClient()

export async function GET({ params }: RequestEvent) {
  if (!params.translationId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.translationId)
  const translation = await prisma.translation.findUnique({ where: { id } })
  return response(translation, null)
}

export async function PUT({ request, params }: RequestEvent) {
  if (!params.translationId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.translationId)
  const data = await request.json()
  console.log('data', data);
  const translation = await prisma.translation.update({ where: { id }, data })
  return response(translation, null)
}