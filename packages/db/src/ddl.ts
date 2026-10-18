import { is, SQL } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { gameTables, WITHOUT_ROWID_TABLES } from './schema/game/index';

function quote(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function literal(value: unknown): string {
  if (value === null) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replaceAll("'", "''")}'`;
}

/**
 * CREATE TABLE + CREATE INDEX statements for one Drizzle table.
 * The Drizzle schema is the single source of truth; this emitter adds what drizzle-kit
 * cannot express (WITHOUT ROWID).
 */
export function tableDdl(table: SQLiteTable, options: { withoutRowid?: boolean } = {}): string[] {
  const config = getTableConfig(table);
  const compositePk = config.primaryKeys[0];
  const definitions: string[] = [];

  for (const column of config.columns) {
    let definition = `${quote(column.name)} ${column.getSQLType()}`;
    if (column.primary && !compositePk) definition += ' PRIMARY KEY';
    if (column.notNull) definition += ' NOT NULL';
    if (column.isUnique) definition += ' UNIQUE';
    if (column.default !== undefined && !is(column.default, SQL)) {
      definition += ` DEFAULT ${literal(column.default)}`;
    }
    definitions.push(definition);
  }

  if (compositePk) {
    definitions.push(`PRIMARY KEY (${compositePk.columns.map((c) => quote(c.name)).join(', ')})`);
  }

  for (const foreignKey of config.foreignKeys) {
    const reference = foreignKey.reference();
    const foreignTable = getTableConfig(reference.foreignTable).name;
    definitions.push(
      `FOREIGN KEY (${reference.columns.map((c) => quote(c.name)).join(', ')}) ` +
        `REFERENCES ${quote(foreignTable)} (${reference.foreignColumns.map((c) => quote(c.name)).join(', ')})`,
    );
  }

  if (options.withoutRowid && !compositePk && !config.columns.some((c) => c.primary)) {
    throw new Error(`WITHOUT ROWID table "${config.name}" needs a primary key`);
  }

  const statements = [
    `CREATE TABLE ${quote(config.name)} (\n  ${definitions.join(',\n  ')}\n)${options.withoutRowid ? ' WITHOUT ROWID' : ''};`,
  ];

  for (const index of config.indexes) {
    const columns = index.config.columns.map((c) => quote((c as { name: string }).name)).join(', ');
    statements.push(
      `CREATE ${index.config.unique ? 'UNIQUE ' : ''}INDEX ${quote(index.config.name)} ON ${quote(config.name)} (${columns});`,
    );
  }

  return statements;
}

/** Full DDL of thedex-data.db (regular tables and indexes; FTS5 is created by the pipeline). */
export function gameSchemaDdl(): string[] {
  return gameTables.flatMap((table) =>
    tableDdl(table, { withoutRowid: WITHOUT_ROWID_TABLES.has(getTableConfig(table).name) }),
  );
}
