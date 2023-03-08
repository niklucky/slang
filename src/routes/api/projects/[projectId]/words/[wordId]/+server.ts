import type { Namespace, Translation } from "@prisma/client";
import type { RequestEvent } from "@sveltejs/kit";

import { response } from "../../../../../../server/lib/response";
import prisma from "../../../../../../server/prisma";
import { saveTranslations } from "../../../../../../server/services/keys";


export async function GET({ params }: RequestEvent) {

  if (!params.wordId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.wordId)
  const key = await prisma.word.findUnique({ where: { id } })
  return response(key, null)
}

export async function PUT({ request, params }: RequestEvent) {
  if (!params.wordId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.wordId)
  const data = await request.json()

  const translationsConnect: Translation[] = await saveTranslations(id, data.translations)

  const key = await prisma.word.findFirstOrThrow({ where: { id }, include: { namespaces: true } })

  const namespacesConnect: number[] = data.namespaces.map((ns: Namespace) => ns.id)
  const namespacesDisconnect = key.namespaces.filter(ns => !namespacesConnect.includes(ns.id))

  data.searchIndex = `${data.name.toLowerCase()} ${data.translations.filter((tr: Translation) => !!tr.value).map((tr: Translation) => tr.value.toLowerCase()).join(' ')}`

  const updatedKey = await prisma.word.update({
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
export async function DELETE({ params }: RequestEvent) {
  if (!params.wordId) {
    return response(null, new Error('id is empty'))
  }
  const id = parseInt(params.wordId)

  await prisma.word.update({
    where: { id },
    data: {
      deletedAt: new Date()
    }
  })

  await prisma.translation.updateMany({
    where: {
      wordId: id,
      deletedAt: null
    },
    data: {
      deletedAt: new Date()
    }
  })

  return response(true, null)
}