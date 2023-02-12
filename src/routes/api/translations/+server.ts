import { PrismaClient } from '@prisma/client';
import type { RequestEvent } from '@sveltejs/kit';
import { response } from '../../../server/lib/response';

const prisma = new PrismaClient()

export async function GET() {
  const translations = await prisma.translation.findMany()
  return response(translations, null)
}

export async function POST({ request }: RequestEvent) {
  const data = await request.json();
  console.log('data', data);
  const translation = await prisma.translation.create({ data })
  return response(translation, null)
}
