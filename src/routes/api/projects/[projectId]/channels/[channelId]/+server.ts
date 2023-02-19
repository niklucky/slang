import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../../../server/lib/response";
import prisma from "../../../../../../server/prisma";

export async function DELETE({ params }: RequestEvent) {
  // const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const channelId = params.channelId ? parseInt(params.channelId) : undefined

  const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })

  await prisma.channel.update(
    {
      where: { id: channel.id },
      data: {
        deletedAt: new Date()
      }
    }
  )
  await prisma.translation.updateMany({
    where: {
      channel: {
        id: channel.id
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
  const channelId = params.channelId ? parseInt(params.channelId) : undefined
  if (!channelId) {
    throw new Error('channelId is empty')
  }
  const data = await request.json();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })

  const channel = await prisma.channel.findUniqueOrThrow({
    where: {
      id: channelId,
    },
    include: {
      project: true
    }
  })
  if (channel.project.id !== project.id) {
    throw new Error('project channel mismatch')
  }
  await prisma.channel.update(
    {
      where: { id: channel.id },
      data
    }
  )
  return response(data, null)
}