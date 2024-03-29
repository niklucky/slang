import type { Locale } from '@prisma/client';
import { error } from '@sveltejs/kit';
import { parse } from 'csv-parse';
import { createReadStream } from "fs";
import { writeFile } from "fs/promises";
import type { RequestEvent } from "../$types";
import { generateId } from "../../../../../library/uid";
import { response } from "../../../../../server/lib/response";
import prisma from '../../../../../server/prisma';

export async function POST({ params, request }: RequestEvent) {
  const projectId = parseInt(params.projectId)

  const data = await request.formData();
  const file = data.get('file') as File;
  console.log('files', file?.toString());

  const name = generateId(36)
  if (file) {
    const fileName = `/tmp/${name}.csv`
    await writeFile(fileName, await file.text())

    const rows: string[][] = []

    createReadStream(fileName)
      .pipe(parse({ delimiter: ",", from_line: 2 }))
      .on('data', (row) => {
        rows.push(row)
      })
      .on("end", () => {
        save(projectId, rows)
      })
  }
  return response({ file: name }, null)
}

async function save(projectId: number, rows: string[][]) {
  const deletedAt = null
  // const channelId = null

  const localesMap: Map<string, Locale> = new Map()

  for (const row of rows) {
    console.log('row', row);
    try {
      let locale = localesMap.get(row[0]) || null
      if (!locale) {
        locale = await prisma.locale.findFirst({
          where: {
            code: row[0]
          }
        })
      }
      console.log('locale', locale);
      if (!locale) {
        throw error(400, { message: 'locale_not_found' })
      }
      localesMap.set(locale.code, locale)
      const localeId = locale.id

      let word = await prisma.word.findFirst({
        where: {
          key: row[1],
          deletedAt: null,
          projectId,
        },
        include: {
          translations: true
        }
      })
      if (word) {
        await prisma.word.update({
          where: { id: word.id },
          data: {
            key: row[1]
          }
        })
      } else {
        word = await prisma.word.create({
          data: {
            key: row[1],
            projectId,
          },
          include: {
            translations: true
          }
        })

      }

      const translation = await prisma.translation.findFirst({
        where: {
          wordId: word.id,
          localeId,
          deletedAt,
        }
      })
      if (translation) {
        await prisma.translation.update({
          where: { id: translation.id },
          data: {
            value: row[2]
          }
        })
      } else {
        await prisma.translation.create({
          data: {
            value: row[2],
            wordId: word.id,
            localeId,
          }
        })
      }
      word = await prisma.word.findUnique({
        where: { id: word.id },
        include: {
          translations: true
        }
      })
      if (!word) {
        continue
      }
      const searchIndex: string[] = [word.key.toLowerCase()]

      word.translations.forEach(v => {
        searchIndex.push(v.value.toLowerCase())
      })
      await prisma.word.update({
        where: {
          id: word.id
        },
        data: {
          searchIndex: searchIndex.join(' ')
        }
      })
      console.log(row);
    } catch (e) {
      console.log('e', e);
      return
    }
  }

}