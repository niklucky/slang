import { PrismaClient, type Namespace, type Translation } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../../server/lib/response';
import { saveTranslations } from '../../../../../server/services/keys';


const prisma = new PrismaClient()

export async function GET({ params }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined

  const keys = await prisma.key.findMany({
    where: {
      projectId
    },
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
