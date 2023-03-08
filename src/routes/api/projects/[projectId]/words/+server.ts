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

  const where: Prisma.WordFindManyArgs['where'] = {
    projectId,
    deletedAt: null
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

  const words = await prisma.word.findMany({
    where,
    include: {
      namespaces: {
        where: {
          deletedAt: null
        }
      },
      translations: {
        where: {
          deletedAt: null
        }
      }
    }
  })
  return response(words, null)
}

export async function POST({ request }: RequestEvent) {
  const data = await request.json();
  console.log('data', data);
  const created = await prisma.word.create({
    data: {
      key: data.key,
      projectId: data.projectId
    }
  })
  const translationsConnect: Translation[] = await saveTranslations(created.id, data.translations)
  data.searchIndex = `${data.name.toLowerCase()} ${data.translations.filter((tr: Translation) => !!tr.value).map((tr: Translation) => tr.value.toLowerCase()).join(' ')}`
  const updated = await prisma.word.update({
    where: { id: created.id },
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
  return response(updated, null)
}
