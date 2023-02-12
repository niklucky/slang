import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../server/lib/response';


const prisma = new PrismaClient()

export async function GET({ url }: RequestEvent) {
  try {
    const projectId = parseInt(url.searchParams.get('projectId') || '')
    const channel = url.searchParams.get('channel')
    const namespace = url.searchParams.get('namespace')
    const locale = url.searchParams.get('locale')

    const last = await prisma.translation.findFirstOrThrow({
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
      },
      orderBy: {
        updatedAt: 'desc'
      },
    })
    return response(last?.updatedAt, null)
  } catch (error: unknown) {
    return new Response(JSON.stringify({
      data: null,
      error: {
        message: (error as Error).message
      }
    }), { status: 404 });
  }
}
