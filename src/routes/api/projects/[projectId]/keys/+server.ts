import type { Namespace, Prisma, Translation } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../../server/lib/response';
import prisma from '../../../../../server/prisma';
import { saveTranslations } from '../../../../../server/services/keys';


export async function GET({ url, params }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const namespaces = url.searchParams.get('namespaces')
  const locales = url.searchParams.get('locales')
  const search = url.searchParams.get('search')

  const where: Prisma.KeyWhereInput = {
    projectId,
  }

  if (namespaces) {
    where.namespaces = {
      some: {
        id: {
          in: namespaces.split(',').map(item => +item)
        }
      }
    }
  }
  if (locales) {
    where.translations = {
      some: {
        locale: {
          id: {
            in: locales.split(',').map(item => +item)
          }
        }
      }
    }
  }

  if (search) {
    where.searchIndex = {
      contains: search.toLowerCase(),
    }
  }

  console.log(where.OR);

  const keys = await prisma.key.findMany({
    where,
    include: {
      namespaces: true,
      translations: true
    }
  })
  return response(keys, null)
}

export async function POST({ request }: RequestEvent) {
  const data = await request.json();
  console.log('data', data);
  const translationsConnect: Translation[] = await saveTranslations(data.translations)
  const key = await prisma.key.create({
    data: {
      ...data,
      namespaces: {
        connect: data.namespaces.map((ns: Namespace) => ({ id: ns.id }))
      },
      translations: {
        connect: translationsConnect.map(item => ({ id: item.id }))
      }
    }
  })
  return response(key, null)
}
