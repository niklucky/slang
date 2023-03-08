import type { User } from "@prisma/client";
import prisma from "../prisma";

export async function findUsers(user: User) {
  return await prisma.user.findMany({
    include: {
      projects: {
        include: {
          project: true
        }
      }
    }
  })
}