import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../../../server/lib/response';


const prisma = new PrismaClient()

export async function GET({ params }: RequestEvent) {
  const projectId = params.projectId ? parseInt(params.projectId) : undefined

  const translations = await prisma.translation.findMany({
    where: {
      projectId
    }
  })
  return response(translations, null)
}

export async function POST({ request }: RequestEvent) {
  const data = await request.json();
  console.log('data', data);
  const translation = await prisma.translation.create({ data })
  return response(translation, null)
}
