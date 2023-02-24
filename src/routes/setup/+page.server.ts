import { redirect } from "@sveltejs/kit";
import prisma from "../../server/prisma";
import type { PageServerLoad } from "./$types";

export const load = (async () => {
  const count = await prisma.user.count()
  if (count) {
    throw redirect(302, '/')
  }
}) satisfies PageServerLoad;

