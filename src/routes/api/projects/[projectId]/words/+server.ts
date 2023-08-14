import type { Prisma } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../../server/lib/response';
import prisma from '../../../../../server/prisma';
import { requireUser } from '../../../../../server/services/auth';
import { createWord } from '../../../../../server/services/word';


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
    },
    orderBy: {
      createdAt: 'desc'
    }
  })
  return response(words, null)
}

export async function POST({ locals, request }: RequestEvent) {
  const data = await request.json();
  const word = await createWord(requireUser(locals.user), data)
  return response(word, null)
}
