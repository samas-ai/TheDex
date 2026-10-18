import { sql, type SQL } from 'drizzle-orm';
import {
  ALIAS_LANG,
  SEARCH_ENTITY_TYPES,
  SEARCH_FTS_TABLE,
  type SearchEntityType,
} from '../schema/game/search';
import { langRank, sqlList } from '../sql';
import { CJK_LANGS, type AnySQLiteDatabase, type GameContext } from '../types';
import { normalizeSearchText, prefixUpperBound } from './normalize';

/** 0 = exact, 1 = prefix, 2 = word prefix, 3 = substring. */
export type MatchRank = 0 | 1 | 2 | 3;

export interface SearchHit {
  readonly entityType: SearchEntityType;
  readonly entityId: number;
  /** Display name in the best language of `langChain`. */
  readonly name: string;
  /** The indexed name that matched (may be another language or an alias). */
  readonly matched: string;
  readonly rank: MatchRank;
  readonly sortKey: number;
}

export interface SearchOptions {
  /** Maximum hits per entity type (default 10). */
  readonly limitPerType?: number;
  /** Restrict to these entity types (default: all). */
  readonly entityTypes?: readonly SearchEntityType[];
}

export interface SearchResult {
  /** Normalized query actually executed. */
  readonly query: string;
  /** Hits ordered by rank, entity priority, then natural order. */
  readonly hits: readonly SearchHit[];
  readonly byType: Partial<Record<SearchEntityType, readonly SearchHit[]>>;
}

interface MatchRow {
  entity_type: SearchEntityType;
  entity_id: number;
  matched: string;
  rank: MatchRank;
  sort_key: number;
}

interface NameRow {
  entity_type: SearchEntityType;
  entity_id: number;
  lang: string;
  name: string;
}

/** Minimum query length served by the trigram index. */
export const TRIGRAM_MIN_LENGTH = 3;

function entityPriority(): SQL {
  const whens = SEARCH_ENTITY_TYPES.map((type, index) => sql` WHEN ${type} THEN ${index}`);
  return sql`CASE entity_type${sql.join(whens, sql``)} ELSE ${SEARCH_ENTITY_TYPES.length} END`;
}

function rankExpression(query: string): SQL {
  return sql`CASE
    WHEN t.name_norm = ${query} THEN 0
    WHEN substr(t.name_norm, 1, ${query.length}) = ${query} THEN 1
    WHEN instr(t.name_norm, ${` ${query}`}) > 0 THEN 2
    ELSE 3 END`;
}

/**
 * Global search (RNF07): substring match over every entity name in the context languages
 * plus aliases. Queries with ≥ 3 characters use the FTS5 trigram index through LIKE;
 * shorter ones use an indexed prefix range plus substring search on CJK rows only.
 */
export async function searchQuery(
  db: AnySQLiteDatabase,
  text: string,
  ctx: Pick<GameContext, 'langChain'>,
  options: SearchOptions = {},
): Promise<SearchResult> {
  const query = normalizeSearchText(text);
  if (query.length === 0) return { query, hits: [], byType: {} };

  const limitPerType = options.limitPerType ?? 10;
  const langs = [...new Set([...ctx.langChain, ALIAS_LANG])];
  const typeFilter = options.entityTypes?.length
    ? sql` AND t.entity_type IN (${sqlList(options.entityTypes)})`
    : sql``;
  const pattern = `%${query}%`;
  const queryLength = Array.from(query).length;

  let matches: SQL;
  if (queryLength >= TRIGRAM_MIN_LENGTH) {
    matches = sql`
      SELECT t.entity_type, t.entity_id, t.name, t.priority, t.sort_key, ${rankExpression(query)} AS rank
      FROM ${sql.identifier(SEARCH_FTS_TABLE)} f
      JOIN search_terms t ON t.id = f.rowid
      WHERE f.name_norm LIKE ${pattern} AND t.lang IN (${sqlList(langs)})${typeFilter}`;
  } else {
    const upper = prefixUpperBound(query);
    const prefix = sql`
      SELECT t.entity_type, t.entity_id, t.name, t.priority, t.sort_key, ${rankExpression(query)} AS rank
      FROM search_terms t
      WHERE t.lang IN (${sqlList(langs)}) AND t.name_norm >= ${query} AND t.name_norm < ${upper}${typeFilter}`;
    const cjkLangs = ctx.langChain.filter((lang) => CJK_LANGS.has(lang));
    matches =
      cjkLangs.length === 0
        ? prefix
        : sql`${prefix}
      UNION ALL
      SELECT t.entity_type, t.entity_id, t.name, t.priority, t.sort_key, 3 AS rank
      FROM search_terms t
      WHERE t.lang IN (${sqlList(cjkLangs)}) AND t.name_norm LIKE ${pattern}
        AND NOT (t.name_norm >= ${query} AND t.name_norm < ${upper})${typeFilter}`;
  }

  const rows = (await db.all(sql`
    WITH matches AS (${matches}),
    best AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY entity_type, entity_id ORDER BY rank, priority
      ) AS entity_rank
      FROM matches
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (
        PARTITION BY entity_type ORDER BY rank, priority, sort_key
      ) AS type_rank
      FROM best WHERE entity_rank = 1
    )
    SELECT entity_type, entity_id, name AS matched, rank, sort_key
    FROM ranked
    WHERE type_rank <= ${limitPerType}
    ORDER BY rank, ${entityPriority()}, priority, sort_key`)) as MatchRow[];

  if (rows.length === 0) return { query, hits: [], byType: {} };

  const keys = sql.join(
    rows.map((row) => sql`(${row.entity_type}, ${row.entity_id})`),
    sql`, `,
  );
  const nameRows = (await db.all(sql`
    SELECT entity_type, entity_id, lang, name
    FROM search_terms
    WHERE (entity_type, entity_id) IN (VALUES ${keys}) AND lang IN (${sqlList(ctx.langChain)})
    ORDER BY ${langRank(sql`lang`, ctx.langChain)}`)) as NameRow[];

  const displayNames = new Map<string, string>();
  for (const row of nameRows) {
    const key = `${row.entity_type}:${row.entity_id}`;
    if (!displayNames.has(key)) displayNames.set(key, row.name);
  }

  const hits: SearchHit[] = rows.map((row) => ({
    entityType: row.entity_type,
    entityId: row.entity_id,
    name: displayNames.get(`${row.entity_type}:${row.entity_id}`) ?? row.matched,
    matched: row.matched,
    rank: row.rank,
    sortKey: row.sort_key,
  }));

  const byType: Partial<Record<SearchEntityType, SearchHit[]>> = {};
  for (const hit of hits) (byType[hit.entityType] ??= []).push(hit);
  return { query, hits, byType };
}
