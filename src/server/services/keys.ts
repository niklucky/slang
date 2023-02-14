import type { Channel, Translation } from "@prisma/client"
import prisma from "../prisma"

export type TranslationExtended = (Translation & { channel: Channel, })

export async function saveTranslations(translations: TranslationExtended[]) {
  const saved: Translation[] = []
  for (const t of translations) {
    if (!t.value) {
      continue
    }
    const data = {
      id: t.id,
      keyId: t.keyId,
      value: t.value,
      localeId: t.localeId,
      channelId: t.channelId,
    }
    if (!data.id) {
      const tr = await prisma.translation.create({ data })
      saved.push(tr)
    } else {
      const tr = await prisma.translation.update({ where: { id: data.id }, data })
      saved.push(tr)
    }
  }
  return saved
}