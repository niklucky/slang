import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../../server/lib/response';


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
  const key = await prisma.key.create({ data })
  return response(key, null)
}
