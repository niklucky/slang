import { response } from '../../../server/lib/response';
import prisma from '../../../server/prisma';

export async function GET() {
  const locales = await prisma.locale.findMany({})
  return response(locales, null)
}

