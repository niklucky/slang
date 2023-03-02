import { error, json, type RequestEvent } from '@sveltejs/kit';
import prisma from '../../../server/prisma';

type I18nFormat = 'i18next'

export async function GET({ url, request }: RequestEvent) {
  const apiKey = request.headers.get('x-api-key')
  if (!apiKey) {
    throw error(401, { message: 'api_key_invalid' })
  }
  const project = await prisma.project.findFirstOrThrow({
    where: {
      apiKey,
    }
  })

  const format = url.searchParams.get('format') as I18nFormat
  const channel = url.searchParams.get('channel')
  const namespace = url.searchParams.get('namespace')
  const locale = url.searchParams.get('locale')

  const translations = await prisma.translation.findMany({
    where: {
      deletedAt: null,
      key: {
        project: {
          id: project.id,
        },
        deletedAt: null,
        namespaces: namespace ? {
          some: {
            name: namespace
          }
        } : undefined
      },
      channel: {
        name: channel || undefined,
      },
      locale: {
        code: locale || undefined
      }
    },
    select: {
      id: true,
      key: {
        select: {
          name: true,
          namespaces: {
            select: {
              name: true
            }
          }
        }
      },
      value: true,
      locale: {
        select: {
          id: true,
          code: true,
        }
      },
      channel: {
        select: {
          id: true,
          name: true
        }
      }
    }
  })
  if (format === 'i18next') {
    return json(prepareI18Next(translations, namespace))
  }
  return json(translations)
}


type RawTranslation = {
  id: number;
  channel: {
    id: number;
    name: string;
  } | null;
  locale: {
    id: number;
    code: string;
  };
  value: string;
  key: {
    name: never;
    namespaces: {
      name: string;
    }[];
  };
}

type TranslationWithNS = Record<string, Record<string, string> | string>
type TranslationWithoutNS = Record<string, Record<string, string>>

function prepareI18Next(items: RawTranslation[], namespace?: string) {
  const result: Record<string, TranslationWithNS | TranslationWithoutNS> = {}
  for (const item of items) {
    if (!result[item.locale.code]) {
      result[item.locale.code] = {}
    }
    if (item.key.namespaces && item.key.namespaces.length && !namespace) {
      for (const ns of item.key.namespaces) {
        if (!result[item.locale.code][ns.name]) {
          result[item.locale.code][ns.name] = {}
        }
        (result[item.locale.code][ns.name] as TranslationWithNS)[item.key.name] = item.value
      }
    } else {
      if (!result[item.locale.code][item.key.name]) {
        result[item.locale.code][item.key.name] = item.value
      }
      result[item.locale.code][item.key.name] = item.value
    }
  }
  return result
}