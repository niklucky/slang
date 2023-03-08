import type { Project, User } from "@prisma/client";
import { generateId } from "../../library/uid";
import prisma from "../prisma";

export enum Role {
  OWNER = 1,
  EDITOR = 2,
  TRANSLATOR = 3
}

export async function createProject(user: User, payload: Partial<Project>) {
  const created = await prisma.project.create({
    data: {
      name: payload.name as string,
      url: payload.url as string,
      description: payload.description,
      apiKey: generateId(64),
      ownerId: user.id,
      users: {
        create: [
          {
            assignedAt: new Date(),
            roleId: Role.OWNER,
            assignedById: user.id,
            userId: user.id
          }
        ]
      }
    },
  })
  return findProjectById(created.id)
}
export async function findProjectById(id: number) {
  return await prisma.project.findUnique({
    where: { id },
    include: {
      owner: true,
      users: true,
      locales: true,
      namespaces: {
        where: {
          deletedAt: null
        }
      },
      channels: {
        where: {
          deletedAt: null
        }
      },
      _count: {
        select: {
          words: true
        }
      }
    },
  })
}

export async function findProjects(user: User) {
  return await prisma.project.findMany({
    where: {
      users: {
        some: {
          userId: user.id
        }
      },
      deletedAt: null
    },
    include: {
      locales: true,
      channels: {
        where: {
          deletedAt: null
        }
      },
      namespaces: {
        where: {
          deletedAt: null
        }
      },
      _count: {
        select: {
          words: true,
        }
      }
    }
  })
}
