import { sql } from 'drizzle-orm';
import { boolean, index, jsonb, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from './auth.js';
import { portal } from './pg-schema.js';

export const projectStatus = portal.enum('project_status', ['pending', 'active', 'removed']);
export const stellarIdKind = portal.enum('stellar_id_kind', ['account', 'contract']);
export const stellarNetwork = portal.enum('stellar_network', ['mainnet', 'testnet']);

/**
 * A tenant. Every tenant-facing query is scoped by `owner_id` (see
 * apps/portal/lib/projects.ts); the Umami website ID is only ever read from
 * this row, never taken from a request.
 */
export const project = portal.table(
  'project',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Hostnames the project will embed the snippet on (informational, shown to operators). */
    domains: text('domains').array().notNull().default(sql`'{}'::text[]`),
    /** Stellar account (G…) or contract (C…) that represents the project. */
    stellarId: text('stellar_id').notNull(),
    stellarIdKind: stellarIdKind('stellar_id_kind').notNull(),
    /** Network the ID was found on; null when existence could not be checked. */
    stellarNetwork: stellarNetwork('stellar_network'),
    stellarVerifiedAt: timestamp('stellar_verified_at', { withTimezone: true }),
    scfUrl: text('scf_url'),
    status: projectStatus('status').notNull().default('active'),
    /** Demo tenants are visible to the public demo operator; real ones are not. */
    isDemo: boolean('is_demo').notNull().default(false),
    /** Created when the project becomes active. */
    umamiWebsiteId: uuid('umami_website_id').unique(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp('removed_at', { withTimezone: true }),
  },
  (t) => [
    index('project_owner_id_idx').on(t.ownerId),
    index('project_status_idx').on(t.status),
  ],
);

/** Global key/value settings, e.g. `enrollment_mode`. */
export const setting = portal.table('setting', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by'),
});

/** Append-only record of operator actions. */
export const auditLog = portal.table(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorEmail: text('actor_email').notNull(),
    action: text('action').notNull(),
    targetType: text('target_type'),
    targetId: text('target_id'),
    details: jsonb('details'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_log_created_at_idx').on(t.createdAt)],
);

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
export type EnrollmentMode = 'open' | 'approval_required';
