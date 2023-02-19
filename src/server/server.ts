import type { Locale } from '@prisma/client';
import allLocales from '../config/locales';
import prisma from "./prisma";

export function init() {
  initLocales()
}

async function initLocales() {
  const locales = await prisma.locale.findMany({})
  const existedLocales: Set<string> = new Set()
  locales.forEach(locale => {
    existedLocales.add(locale.code)
  })

  const localesToCreate: Map<string, Partial<Locale>> = new Map()
  allLocales.forEach(locale => {
    if (!existedLocales.has(locale.code)) {
      localesToCreate.set(locale.code, locale)
    }
  })
  if (localesToCreate.size > 0) {
    const locales = Array.from(localesToCreate.values())
    for (const locale of locales) {

      await prisma.locale.create({
        data: {
          code: locale.code as string,
          countryCode: locale.code,
          name: locale.name as string,
          title: locale.name as string
        }
      })
    }
  }
}