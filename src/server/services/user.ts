import type { User } from "@prisma/client";
import prisma from "../prisma";

export async function getUserById(id: number) {
  return await prisma.user.findFirstOrThrow({
    where: {
      id
    },
    include: {
      projects: {
        include: {
          project: true
        }
      }
    }
  })
}
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