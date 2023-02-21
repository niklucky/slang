import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../server/lib/response';


const prisma = new PrismaClient()

export async function GET({ url, request }: RequestEvent) {
  try {
    const apiKey = request.headers.get('x-api-key')
    if (!apiKey) {
      throw new Error('auth_error')
    }
    const project = await prisma.project.findFirstOrThrow({
      where: {
        apiKey,
      }
    })

    const channel = url.searchParams.get('channel')
    const namespace = url.searchParams.get('namespace')
    const locale = url.searchParams.get('locale')

    const last = await prisma.translation.findFirstOrThrow({
      where: {
        key: {
          project: {
            id: project.id
          },
          namespaces: {
            some: {
              name: namespace || undefined
            }
          },

        },
        channel: {
          name: channel || undefined,
        },
        locale: {
          code: locale || undefined
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
