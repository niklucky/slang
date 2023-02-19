import type { Namespace, Translation } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../../server/lib/response';
import prisma from '../../../../../server/prisma';
import { saveTranslations } from '../../../../../server/services/keys';


export async function GET({ url, params }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined
  const namespaces = url.searchParams.get('namespaces')
  const locales = url.searchParams.get('locales')
  const search = url.searchParams.get('search')

  const where: any = {
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

  const keys = await prisma.key.findMany({
    where,
    include: {
      namespaces: true,
      translations: {
        where: {
          deletedAt: null
        }
      }
    }
  })
  return response(keys, null)
}

export async function POST({ request }: RequestEvent) {
  const data = await request.json();
  console.log('data', data);
  const created: any = await prisma.key.create({
    data: {
      name: data.name,
      projectId: data.projectId
    }
  })
  const translationsConnect: Translation[] = await saveTranslations(created.id, data.translations)
  data.searchIndex = `${data.name.toLowerCase()} ${data.translations.filter((tr: Translation) => !!tr.value).map((tr: Translation) => tr.value.toLowerCase()).join(' ')}`
  const updated = await prisma.key.update({
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
