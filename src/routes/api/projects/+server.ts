import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../server/lib/response';

const prisma = new PrismaClient()

export async function GET() {
  const projects = await prisma.project.findMany({
    where: {
      deletedAt: null
    },
    include: {
      locales: true,
      channels: {
        where: {
          deletedAt: null
        }
      },
      namespaces: {
        where: {
          deletedAt: null
        }
      },
      _count: {
        select: {
          keys: true,
        }
      }
    }
  })
  return response(projects, null)
}

export async function POST({ request }: RequestEvent) {
  const payload = await request.json();
  const data = {
    name: payload.name,
    url: payload.url,
    description: payload.description,
  }
  const created = await prisma.project.create({ data })
  const project = await prisma.project.findUnique({
    where: { id: created.id },
    include: {
      locales: true,
      namespaces: {
        where: {
          deletedAt: null
        }
      },
      channels: {
        where: {
          deletedAt: null
        }
      },
      _count: {
        select: {
          keys: true
        }
      }
    },
  })
  return response(project, null)
}
