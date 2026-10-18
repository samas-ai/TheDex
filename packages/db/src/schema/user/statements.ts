import { userMigrations } from './migrations.generated';

/**
 * Every user-DB migration as individual SQL statements, in order. For tooling that needs a
 * schema-identical thedex-user.db without the Drizzle migrator (query-plan checks, tests).
 */
export function userSchemaStatements(): string[] {
  return Object.keys(userMigrations.migrations)
    .sort()
    .flatMap((key) =>
      userMigrations.migrations[key as keyof typeof userMigrations.migrations]
        .split('--> statement-breakpoint')
        .map((statement) => statement.trim())
        .filter((statement) => statement !== ''),
    );
}
