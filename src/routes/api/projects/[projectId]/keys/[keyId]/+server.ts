import type { Namespace, Translation } from "@prisma/client";
import type { RequestEvent } from "@sveltejs/kit";

import { response } from "../../../../../../server/lib/response";
import prisma from "../../../../../../server/prisma";
import { saveTranslations } from "../../../../../../server/services/keys";





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

  const translationsConnect: Translation[] = await saveTranslations(data.translations)

  const key = await prisma.key.findFirstOrThrow({ where: { id }, include: { namespaces: true } })

  const namespacesConnect: number[] = data.namespaces.map((ns: Namespace) => ns.id)
  const namespacesDisconnect = key.namespaces.filter(ns => !namespacesConnect.includes(ns.id))

  data.searchIndex = `${data.name.toLowerCase()} ${data.translations.filter((tr: Translation) => !!tr.value).map((tr: Translation) => tr.value.toLowerCase()).join(' ')}`

  const updatedKey = await prisma.key.update({
    where: { id },
    data: {
      ...data,
      namespaces: {
        connect: namespacesConnect.map((id: number) => ({ id })),
        disconnect: namespacesDisconnect.map(ns => ({ id: ns.id }))
      },
      translations: {
        connect: translationsConnect.map(t => ({ id: t.id }))
      }
    }
  })
  return response(updatedKey, null)
}