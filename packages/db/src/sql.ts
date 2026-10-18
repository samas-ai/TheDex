import { sql, type SQL } from 'drizzle-orm';

/** `?, ?, ?` placeholder list for an IN clause. */
export function sqlList(values: readonly (string | number)[]): SQL {
  if (values.length === 0) throw new Error('sqlList requires at least one value');
  return sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );
}

/** `CASE <column> WHEN ?1 THEN 0 WHEN ?2 THEN 1 … ELSE n END` — language preference order. */
export function langRank(column: SQL, langChain: readonly string[]): SQL {
  const whens = langChain.map((lang, index) => sql` WHEN ${lang} THEN ${index}`);
  return sql`CASE ${column}${sql.join(whens, sql``)} ELSE ${langChain.length} END`;
}

/**
 * Correlated subquery picking a translated column in `langChain` order, e.g. the species
 * name in pt-BR, falling back to en. Uses the `(<id>, lang)` primary key of i18n tables.
 */
export function pickI18n(
  table: string,
  idColumn: string,
  idExpression: SQL,
  column: string,
  langChain: readonly string[],
): SQL {
  return sql`(SELECT ${sql.identifier(column)} FROM ${sql.identifier(table)} WHERE ${sql.identifier(idColumn)} = ${idExpression} AND lang IN (${sqlList(langChain)}) AND ${sql.identifier(column)} IS NOT NULL ORDER BY ${langRank(sql`lang`, langChain)} LIMIT 1)`;
}
