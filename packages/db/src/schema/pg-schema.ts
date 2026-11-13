import { pgSchema } from 'drizzle-orm/pg-core';

/** Portal tables (accounts, projects, settings, audit log). Umami lives in its own database. */
export const portal = pgSchema('portal');
