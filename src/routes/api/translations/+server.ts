import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../server/lib/response';

const prisma = new PrismaClient()

export async function GET({ url }: RequestEvent) {
  const projectId = parseInt(url.searchParams.get('projectId') || '')
  const channel = url.searchParams.get('channel')
  const namespace = url.searchParams.get('namespace')
  const locale = url.searchParams.get('locale')

  const projects = await prisma.translation.findMany({
    where: {
      projectId,
      channel: {
        name: channel || undefined,
      },
      namespace: {
        name: namespace || undefined
      },
      locale: {
        name: locale || undefined
      }
    }
  })
  return response(projects, null)
}
