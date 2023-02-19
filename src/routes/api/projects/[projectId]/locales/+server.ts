import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../../server/lib/response";
import prisma from "../../../../../server/prisma";

export async function POST({ params, request }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const data = await request.json();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const locale = await prisma.locale.findUniqueOrThrow({ where: { id: data.localeId } })
  await prisma.project.update(
    {
      where: { id: project.id },
      data: {
        locales: {
          connect: {
            id: locale.id
          }
        }
      }
    }
  )
  return response(data, null)
}
export async function DELETE({ params, request }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const data = await request.json();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const locale = await prisma.locale.findUniqueOrThrow({ where: { id: data.localeId } })
  await prisma.project.update(
    {
      where: { id: project.id },
      data: {
        locales: {
          disconnect: {
            id: locale.id
          }
        }
      }
    }
  )
  await prisma.translation.updateMany({
    where: {
      localeId: locale.id
    },
    data: {
      deletedAt: new Date()
    }
  })
  return response(data, null)
}
export async function PUT({ params, request }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const data = await request.json();
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } })
  const toLocale = await prisma.locale.findUniqueOrThrow({ where: { id: data.toLocaleId } })
  const fromLocale = await prisma.locale.findUniqueOrThrow({ where: { id: data.fromLocaleId } })
  await prisma.project.update(
    {
      where: { id: project.id },
      data: {
        locales: {
          connect: {
            id: toLocale.id
          },
          disconnect: {
            id: fromLocale.id
          }
        }
      }
    }
  )
  await prisma.translation.updateMany({
    where: {
      localeId: fromLocale.id,
      deletedAt: null
    },
    data: {
      localeId: toLocale.id
    }
  })
  return response(data, null)
}