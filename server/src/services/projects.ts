import { and, count, eq, inArray, isNull, or } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import {
  channels,
  DEFAULT_CHANNEL,
  locales,
  namespaces,
  projects,
  projectsToLocales,
  Role,
  usersToProjects,
  words,
  type Project,
} from '../db/schema.js';
import { generateApiKey } from '../lib/ids.js';

export interface CreateProjectInput {
  name: string;
  url: string;
  description?: string;
}

export async function createProject(
  db: Database,
  ownerId: number,
  input: CreateProjectInput,
): Promise<Project> {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        ownerId,
        name: input.name,
        url: input.url,
        ...(input.description !== undefined ? { description: input.description } : {}),
        apiKey: generateApiKey(),
      })
      .returning();
    if (!project) throw new Error('project_insert_failed');
    await tx.insert(channels).values({ projectId: project.id, name: DEFAULT_CHANNEL });
    await tx.insert(usersToProjects).values({
      projectId: project.id,
      userId: ownerId,
      assignedById: ownerId,
      roleId: Role.OWNER,
    });
    return project;
  });
}

export interface ProjectSummary extends Project {
  wordCount: number;
  localeCount: number;
}

export async function findProjectsForUser(db: Database, userId: number): Promise<ProjectSummary[]> {
  const rows = await db
    .select({ project: projects })
    .from(projects)
    .leftJoin(usersToProjects, eq(usersToProjects.projectId, projects.id))
    .where(
      and(
        isNull(projects.deletedAt),
        or(eq(projects.ownerId, userId), eq(usersToProjects.userId, userId)),
      ),
    )
    .groupBy(projects.id);

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.project.id);
  const [wordCounts, localeCounts] = await Promise.all([
    db
      .select({ projectId: words.projectId, value: count() })
      .from(words)
      .where(and(isNull(words.deletedAt), inArray(words.projectId, ids)))
      .groupBy(words.projectId),
    db
      .select({ projectId: projectsToLocales.projectId, value: count() })
      .from(projectsToLocales)
      .where(inArray(projectsToLocales.projectId, ids))
      .groupBy(projectsToLocales.projectId),
  ]);

  const wordsByProject = new Map(wordCounts.map((row) => [row.projectId, row.value]));
  const localesByProject = new Map(localeCounts.map((row) => [row.projectId, row.value]));

  return rows.map(({ project }) => ({
    ...project,
    wordCount: wordsByProject.get(project.id) ?? 0,
    localeCount: localesByProject.get(project.id) ?? 0,
  }));
}

/** Project row when the user owns it or holds a membership, otherwise null. */
export async function findProjectForUser(
  db: Database,
  projectId: number,
  userId: number,
): Promise<Project | null> {
  const rows = await db
    .select({ project: projects })
    .from(projects)
    .leftJoin(usersToProjects, eq(usersToProjects.projectId, projects.id))
    .where(
      and(
        eq(projects.id, projectId),
        isNull(projects.deletedAt),
        or(eq(projects.ownerId, userId), eq(usersToProjects.userId, userId)),
      ),
    )
    .limit(1);
  return rows[0]?.project ?? null;
}

export interface ProjectDetails {
  project: Project;
  locales: Array<{ id: number; code: string; name: string; title: string; countryCode: string }>;
  channels: Array<{ id: number; name: string }>;
  namespaces: Array<{ id: number; name: string }>;
  wordCount: number;
}

export async function findProjectDetails(db: Database, project: Project): Promise<ProjectDetails> {
  const [projectLocales, projectChannels, projectNamespaces, wordCountRows] = await Promise.all([
    db
      .select({
        id: locales.id,
        code: locales.code,
        name: locales.name,
        title: locales.title,
        countryCode: locales.countryCode,
      })
      .from(projectsToLocales)
      .innerJoin(locales, eq(projectsToLocales.localeId, locales.id))
      .where(eq(projectsToLocales.projectId, project.id))
      .orderBy(locales.code),
    db
      .select({ id: channels.id, name: channels.name })
      .from(channels)
      .where(and(eq(channels.projectId, project.id), isNull(channels.deletedAt)))
      .orderBy(channels.id),
    db
      .select({ id: namespaces.id, name: namespaces.name })
      .from(namespaces)
      .where(and(eq(namespaces.projectId, project.id), isNull(namespaces.deletedAt)))
      .orderBy(namespaces.name),
    db
      .select({ value: count() })
      .from(words)
      .where(and(eq(words.projectId, project.id), isNull(words.deletedAt))),
  ]);

  return {
    project,
    locales: projectLocales,
    channels: projectChannels,
    namespaces: projectNamespaces,
    wordCount: wordCountRows[0]?.value ?? 0,
  };
}

export async function updateProject(
  db: Database,
  projectId: number,
  input: Partial<CreateProjectInput>,
): Promise<Project | null> {
  const [project] = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .returning();
  return project ?? null;
}

export async function softDeleteProject(db: Database, projectId: number): Promise<boolean> {
  const rows = await db
    .update(projects)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), isNull(projects.deletedAt)))
    .returning({ id: projects.id });
  return rows.length > 0;
}
