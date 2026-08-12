import { and, count, desc, eq, exists, inArray, isNull, max, notExists, or } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import {
  channels,
  DEFAULT_CHANNEL,
  locales,
  namespaces,
  projects,
  projectsToLocales,
  Role,
  translationVersions,
  translations,
  users,
  usersToProjects,
  wordVersions,
  words,
  type Project,
} from '../db/schema.js';
import { generateApiKey } from '../lib/ids.js';

export interface CreateProjectInput {
  name: string;
  url: string | null;
  description?: string | null;
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
  untranslatedCount: number;
  /** Member display names, owner first, then by join order. */
  members: Array<{ name: string }>;
  /** Newest key/translation activity; falls back to the project's own update time. */
  lastActivityAt: Date;
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
    .groupBy(projects.id)
    .orderBy(desc(projects.id));

  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.project.id);
  const [wordCounts, localeCounts, untranslatedCounts, memberRows, translationActivity, wordActivity] = await Promise.all([
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
    // Words missing a translation for at least one of the project's locales.
    db
      .select({ projectId: words.projectId, value: count() })
      .from(words)
      .where(
        and(
          isNull(words.deletedAt),
          inArray(words.projectId, ids),
          exists(
            db
              .select()
              .from(projectsToLocales)
              .where(
                and(
                  eq(projectsToLocales.projectId, words.projectId),
                  notExists(
                    db
                      .select()
                      .from(translations)
                      .where(
                        and(
                          eq(translations.wordId, words.id),
                          eq(translations.localeId, projectsToLocales.localeId),
                          isNull(translations.deletedAt),
                        ),
                      ),
                  ),
                ),
              ),
          ),
        ),
      )
      .groupBy(words.projectId),
    db
      .select({
        projectId: usersToProjects.projectId,
        userId: usersToProjects.userId,
        name: users.name,
        assignedAt: usersToProjects.assignedAt,
      })
      .from(usersToProjects)
      .innerJoin(users, eq(usersToProjects.userId, users.id))
      .where(inArray(usersToProjects.projectId, ids))
      .orderBy(usersToProjects.assignedAt),
    // Newest activity per project, split by version table.
    db
      .select({ projectId: words.projectId, value: max(translationVersions.createdAt) })
      .from(translationVersions)
      .innerJoin(words, eq(words.id, translationVersions.wordId))
      .where(inArray(words.projectId, ids))
      .groupBy(words.projectId),
    db
      .select({ projectId: words.projectId, value: max(wordVersions.createdAt) })
      .from(wordVersions)
      .innerJoin(words, eq(words.id, wordVersions.wordId))
      .where(inArray(words.projectId, ids))
      .groupBy(words.projectId),
  ]);

  const wordsByProject = new Map(wordCounts.map((row) => [row.projectId, row.value]));
  const localesByProject = new Map(localeCounts.map((row) => [row.projectId, row.value]));
  const untranslatedByProject = new Map(
    untranslatedCounts.map((row) => [row.projectId, row.value]),
  );

  const ownerByProject = new Map(rows.map(({ project }) => [project.id, project.ownerId]));
  const membersByProject = new Map<
    number,
    Array<{ userId: number; name: string; isOwner: boolean; assignedAt: Date }>
  >();
  for (const row of memberRows) {
    const list = membersByProject.get(row.projectId) ?? [];
    list.push({ ...row, isOwner: row.userId === ownerByProject.get(row.projectId) });
    membersByProject.set(row.projectId, list);
  }
  // Defensive against legacy data: include the owner even without a membership row.
  const ownerIdsWithoutMembership = [
    ...new Set(
      rows
        .filter(({ project }) => {
          const list = membersByProject.get(project.id) ?? [];
          return !list.some((member) => member.userId === project.ownerId);
        })
        .map(({ project }) => project.ownerId),
    ),
  ];
  const ownersWithoutMembership =
    ownerIdsWithoutMembership.length > 0
      ? await db
          .select({ id: users.id, name: users.name, createdAt: users.createdAt })
          .from(users)
          .where(inArray(users.id, ownerIdsWithoutMembership))
      : [];
  for (const owner of ownersWithoutMembership) {
    for (const { project } of rows) {
      if (project.ownerId !== owner.id) continue;
      const list = membersByProject.get(project.id) ?? [];
      list.unshift({ userId: owner.id, name: owner.name, isOwner: true, assignedAt: owner.createdAt });
      membersByProject.set(project.id, list);
    }
  }

  const activityByProject = new Map<number, Date>();
  for (const row of [...translationActivity, ...wordActivity]) {
    if (!row.value) continue;
    const current = activityByProject.get(row.projectId);
    if (!current || row.value.getTime() > current.getTime()) {
      activityByProject.set(row.projectId, row.value);
    }
  }

  return rows.map(({ project }) => {
    const members = membersByProject.get(project.id) ?? [];
    members.sort(
      (a, b) =>
        Number(b.isOwner) - Number(a.isOwner) || a.assignedAt.getTime() - b.assignedAt.getTime(),
    );
    return {
      ...project,
      wordCount: wordsByProject.get(project.id) ?? 0,
      localeCount: localesByProject.get(project.id) ?? 0,
      untranslatedCount: untranslatedByProject.get(project.id) ?? 0,
      members: members.map(({ name }) => ({ name })),
      lastActivityAt: activityByProject.get(project.id) ?? project.updatedAt,
    };
  });
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

export async function regenerateApiKey(
  db: Database,
  projectId: number,
): Promise<Project | null> {
  const [project] = await db
    .update(projects)
    .set({ apiKey: generateApiKey(), updatedAt: new Date() })
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
