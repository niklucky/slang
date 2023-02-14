import type { Namespace } from "@prisma/client";
import type { RequestEvent } from "@sveltejs/kit";
import { response } from "../../../../../../server/lib/response";
import prisma from "../../../../../../server/prisma";


export async function GET({ params }: RequestEvent) {
  if (!params.keyId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.keyId)
  const key = await prisma.key.findUnique({ where: { id } })
  return response(key, null)
}

export async function PUT({ request, params }: RequestEvent) {
  if (!params.keyId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.keyId)
  const data = await request.json()
  console.log('data', data);

  const translationsConnect: number[] = []

  for (const t of data.translations) {
    if (!t.value) {
      continue
    }
    delete t.channel
    delete t.locale
    if (!t.id) {
      const tr = await prisma.translation.create({ data: t })
      translationsConnect.push(tr.id)
    } else {
      const tr = await prisma.translation.update({ where: { id: t.id }, data: t })
      translationsConnect.push(tr.id)
    }
  }
  const key = await prisma.key.findFirstOrThrow({ where: { id }, include: { namespaces: true } })

  const namespacesConnect: number[] = data.namespaces.map((ns: Namespace) => ns.id)
  const namespacesDisconnect = key.namespaces.filter(ns => !namespacesConnect.includes(ns.id))

  const updatedKey = await prisma.key.update({
    where: { id },
    data: {
      ...data,
      namespaces: {
        connect: namespacesConnect.map((id: number) => ({ id })),
        disconnect: namespacesDisconnect.map(ns => ({ id: ns.id }))
      },
      translations: {
        connect: translationsConnect.map(id => ({ id }))
      }
    }
  })
  return response(updatedKey, null)
}