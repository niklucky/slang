import { PrismaClient } from "@prisma/client";
import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../server/lib/response";

const prisma = new PrismaClient()

export async function GET({ params }: RequestEvent) {
  if (!params.projectId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.projectId)
  const project = await prisma.project.findUnique({ where: { id } })
  return response(project, null)
}

export async function PUT({ request, params }: RequestEvent) {
  if (!params.projectId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.projectId)
  const data = await request.json()
  const project = await prisma.project.update({ where: { id }, data })
  return response(project, null)
}