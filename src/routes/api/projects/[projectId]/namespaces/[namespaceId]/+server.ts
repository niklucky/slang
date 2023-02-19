import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../../../server/lib/response";
import prisma from "../../../../../../server/prisma";

export async function DELETE({ params }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const namespaceId = params.namespaceId ? parseInt(params.namespaceId) : undefined

  const namespace = await prisma.namespace.findUniqueOrThrow({ where: { id: namespaceId } })

  await prisma.namespace.update(
    {
      where: { id: namespace.id },
      data: {
        deletedAt: new Date()
      }
    }
  )
  await prisma.key.updateMany({
    where: {
      projectId,
      namespaces: {
        every: {
          id: namespaceId
        }
      }
    },
    data: {
      deletedAt: new Date()
    }
  })
  return response(true, null)
}
export async function PUT({ params, request }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const namespaceId = params.namespaceId ? parseInt(params.namespaceId) : undefined
  if (!namespaceId) {
    throw new Error('namespaceId is empty')
  }
  const data = await request.json();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const namespace = await prisma.namespace.findUniqueOrThrow({
    where: {
      id: namespaceId,
    },
    include: {
      project: true
    }
  })
  if (namespace.project.id !== project.id) {
    throw new Error('project namespace mismatch')
  }
  await prisma.namespace.update(
    {
      where: { id: namespace.id },
      data
    }
  )
  return response(data, null)
}