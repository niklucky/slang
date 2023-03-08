import type { Prisma, Project, User } from "@prisma/client";
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
  return findProject({ id: created.id })
}

export async function deleteProject(user: User, id: number) {
  await prisma.project.findFirstOrThrow({
    where: { id, ownerId: user.id }
  })

  return await prisma.project.update({
    where: { id },
    data: { deletedAt: new Date() }
  })

}
export async function updateProject(user: User, id: number, payload: Partial<Project>) {
  const project = await prisma.project.findFirstOrThrow({
    where: { id, ownerId: user.id }
  })
  const data = {
    name: payload.name,
    url: payload.url,
    description: payload.description,
  }
  return await prisma.project.update({ where: { id: project.id }, data })
}

export async function findProjectById(user: User, id: number) {
  return findProject({
    id,
    users: {
      some: {
        userId: user.id
      }
    }
  })
}
export async function findProject(where: Prisma.ProjectWhereInput) {
  return await prisma.project.findFirstOrThrow({
    where,
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
