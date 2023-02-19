import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../../server/lib/response";
import prisma from "../../../../../server/prisma";

export async function POST({ request }: RequestEvent) {
  const data = await request.json();
  delete data.id

  const namespace = await prisma.namespace.create({ data })
  return response(namespace, null)
}
