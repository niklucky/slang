import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../server/lib/response';

const prisma = new PrismaClient()

export async function GET() {
  const projects = await prisma.project.findMany({
    include: {
      locales: true,
      channels: true,
      namespaces: true,
      _count: {
        select: {
          keys: true,
          channels: true
        }
      }
    }
  })
  return response(projects, null)
}

export async function POST({ request }: RequestEvent) {
  const data = await request.json();
  const project = await prisma.project.create({ data })
  return response(project, null)
}
