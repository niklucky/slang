import type { RequestEvent } from "@sveltejs/kit";

import { response } from "../../../../../../server/lib/response";
import { requireParam } from "../../../../../../server/lib/validation";
import prisma from "../../../../../../server/prisma";
import { requireUser } from "../../../../../../server/services/auth";
import { updateWord } from "../../../../../../server/services/word";


export async function GET({ params }: RequestEvent) {
  const id = parseInt(requireParam(params, 'wordId'))
  const word = await prisma.word.findUnique({ where: { id } })
  return response(word, null)
}

export async function PUT({ request, params, locals }: RequestEvent) {
  const id = parseInt(requireParam(params, 'wordId'))
  const data = await request.json();
  const word = await updateWord(requireUser(locals.user), id, data)
  return response(word, null)
}

export async function DELETE({ params }: RequestEvent) {
  const id = parseInt(requireParam(params, 'wordId'))

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