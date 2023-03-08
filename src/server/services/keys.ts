import type { Channel, Prisma, Translation } from "@prisma/client"
import prisma from "../prisma"

export type TranslationExtended = (Translation & { channel: Channel, })

export async function saveTranslations(wordId: number, translations: TranslationExtended[]) {
  const saved: Translation[] = []
  for (const t of translations) {
    if (!t.value) {
      continue
    }
    const data: Prisma.TranslationUncheckedCreateInput = {
      wordId,
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