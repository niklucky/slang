import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../server/lib/response';
import prisma from '../../../server/prisma';


export async function GET({ url, request }: RequestEvent) {
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

  const translations = await prisma.translation.findMany({
    where: {
      key: {
        project: {
          id: project.id,
        },
        namespaces: {
          some: {
            name: namespace || undefined
          }
        }
      },
      channel: {
        name: channel || undefined,
      },
      locale: {
        code: locale || undefined
      }
    },
    select: {
      id: true,
      key: {
        select: {
          name: true,
          namespaces: {
            select: {
              name: true
            }
          }
        }
      },
      value: true,
      locale: {
        select: {
          id: true,
          code: true,
        }
      },
      channel: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
  const prepared = translations.map(item => {
    return {
      key: item.key.name,
      value: item.value,
      ns: namespace ? undefined : item.key.namespaces.map(ns => ns.name),
      channel: channel ? undefined : item.channel?.name,
      locale: locale ? undefined : item.locale.code
    }
  })
  return response(prepared, null)
}

