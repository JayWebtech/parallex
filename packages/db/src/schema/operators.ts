import { index, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { portal } from './pg-schema.js';

/**
 * Read-only machine access for operators (SCF) to /api/v1/metrics/*.
 * Only a SHA-256 of the key is stored; the plaintext is shown once.
 */
export const operatorApiKey = portal.table(
  'operator_api_key',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    createdBy: text('created_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedBy: text('revoked_by'),
  },
  (t) => [index('operator_api_key_created_at_idx').on(t.createdAt)],
);
