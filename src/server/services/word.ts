import type { Channel, Namespace, Prisma, Translation, User, Word } from "@prisma/client";
import prisma from "../prisma";

export type TranslationExtended = (Translation & { channel: Channel, })

export async function createWord(user: User, payload: Partial<Word> & { translations: TranslationExtended[], namespaces: Namespace[] }) {
  const word = await prisma.word.create({
    data: {
      key: payload.key as string,
      projectId: payload.projectId as number,
    }
  })
  if (payload.translations.length) {
    const translations: Translation[] = await saveTranslations(word, payload.translations)
    word.searchIndex = setSearchIndex(word, translations)
    await connect(word, translations, payload.namespaces)
    // return findById(word.id)
  }
  return word
}

export async function updateWord(user: User, id: number, data: Word & { translations: TranslationExtended[], namespaces: Namespace[] }) {
  const word = await prisma.word.findFirstOrThrow({ where: { id }, include: { namespaces: true } })

  const translationsConnect: Translation[] = await saveTranslations(word, data.translations)

  const namespacesConnect: number[] = data.namespaces.map((ns: Namespace) => ns.id)
  const namespacesDisconnect = word.namespaces.filter(ns => !namespacesConnect.includes(ns.id))

  data.searchIndex = setSearchIndex(word, data.translations)

  return await prisma.word.update({
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
}

export async function saveTranslations(word: Word, translations: TranslationExtended[]) {
  const saved: Translation[] = []
  for (const t of translations) {
    if (!t.value) {
      continue
    }
    const data: Prisma.TranslationUncheckedCreateInput = {
      wordId: word.id,
      value: t.value,
      localeId: t.localeId,
      channelId: t.channelId
    }
    if (!t.id) {
      const tr = await prisma.translation.create({ data })
      saved.push(tr)
    } else {
      const tr = await prisma.translation.update({ where: { id: t.id }, data })
      saved.push(tr)
    }
  }
  return saved
}

function setSearchIndex(word: Word, translations: Translation[]) {
  return `${word.key.toLowerCase()} ${translations.filter((tr: Translation) => !!tr.value).map((tr: Translation) => tr.value.toLowerCase()).join(' ')}`
}

async function connect(word: Word, translations: Translation[], namespaces: Namespace[]) {
  await prisma.word.update({
    where: { id: word.id },
    data: {
      ...word,
      namespaces: {
        connect: namespaces.map((ns: Namespace) => ({ id: ns.id }))
      },
      translations: {
        connect: translations.map(item => ({ id: item.id }))
      }
    }
  })
}