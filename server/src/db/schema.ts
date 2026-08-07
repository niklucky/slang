import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  password: text('password').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/** Global catalog, seeded from `locales-catalog.ts` at boot. */
export const locales = pgTable('locales', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  countryCode: text('country_code').notNull().default('us'),
  name: text('name').notNull(),
  title: text('title').notNull(),
});

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  ownerId: integer('owner_id')
    .notNull()
    .references(() => users.id),
  name: text('name').notNull(),
  url: text('url'),
  description: text('description'),
  apiKey: text('api_key').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

/** Project membership. `roleId`: 1 owner, 2 editor, 3 translator. */
export const usersToProjects = pgTable(
  'users_to_projects',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id),
    assignedById: integer('assigned_by_id').notNull(),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
    roleId: integer('role_id').notNull().default(1),
    canCreateKeys: boolean('can_create_keys').notNull().default(true),
    canTranslate: boolean('can_translate').notNull().default(true),
    canDeleteKeys: boolean('can_delete_keys').notNull().default(true),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.userId] })],
);

/**
 * Project invitations, addressed to an email. Existing accounts with that
 * email accept via the in-app banner; new people register through the
 * emailed link.
 */
export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id),
  invitedById: integer('invited_by_id')
    .notNull()
    .references(() => users.id),
  email: text('email').notNull(),
  key: text('key').notNull().unique(),
  status: text('status', { enum: ['pending', 'accepted', 'declined'] })
    .notNull()
    .default('pending'),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const projectsToLocales = pgTable(
  'projects_to_locales',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    localeId: integer('locale_id')
      .notNull()
      .references(() => locales.id),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.localeId] })],
);

/**
 * Environments. Projects created through the app get a `default` channel, but
 * `translations.channelId` stays nullable so saves work for projects without one.
 */
export const channels = pgTable(
  'channels',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('channels_project_name_unique')
      .on(t.projectId, t.name)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const namespaces = pgTable(
  'namespaces',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('namespaces_project_name_unique')
      .on(t.projectId, t.name)
      .where(sql`deleted_at IS NULL`),
  ],
);

/** A translation key. */
export const words = pgTable(
  'words',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id),
    key: text('key').notNull(),
    /** Lowercased key + translation values; substring search target. */
    searchIndex: text('search_index').notNull().default(''),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('words_project_key_unique')
      .on(t.projectId, t.key)
      .where(sql`deleted_at IS NULL`),
  ],
);

export const wordsToNamespaces = pgTable(
  'words_to_namespaces',
  {
    wordId: integer('word_id')
      .notNull()
      .references(() => words.id),
    namespaceId: integer('namespace_id')
      .notNull()
      .references(() => namespaces.id),
  },
  (t) => [primaryKey({ columns: [t.wordId, t.namespaceId] })],
);

export const translations = pgTable(
  'translations',
  {
    id: serial('id').primaryKey(),
    wordId: integer('word_id')
      .notNull()
      .references(() => words.id),
    localeId: integer('locale_id')
      .notNull()
      .references(() => locales.id),
    channelId: integer('channel_id').references(() => channels.id),
    value: text('value').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('translations_word_locale_channel_unique')
      .on(t.wordId, t.localeId, t.channelId)
      .where(sql`deleted_at IS NULL`),
  ],
);

export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Locale = typeof locales.$inferSelect;
export type Channel = typeof channels.$inferSelect;
export type Namespace = typeof namespaces.$inferSelect;
export type Word = typeof words.$inferSelect;
export type Translation = typeof translations.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type InvitationStatus = Invitation['status'];

export const Role = {
  OWNER: 1,
  EDITOR: 2,
  TRANSLATOR: 3,
} as const;

export const DEFAULT_CHANNEL = 'default';
