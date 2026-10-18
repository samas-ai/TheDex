import { sql } from 'drizzle-orm';
import { langRank, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';

/** Per-version-group description tables (move, ability and item descriptions). */
const FLAVOR_TABLES = {
  move_flavor_text: 'move_id',
  ability_flavor_text: 'ability_id',
  item_flavor_text: 'item_id',
} as const;
export type FlavorTable = keyof typeof FLAVOR_TABLES;

/**
 * In-game description of a move, ability or item: the context game's, else the latest earlier
 * one (games PokeAPI has no text for), in the best language of the chain.
 */
export async function latestFlavorText(
  db: AnySQLiteDatabase,
  table: FlavorTable,
  id: number,
  ctx: GameContext,
): Promise<string | null> {
  const { langChain } = ctx;
  const row = (await db.get(sql`
    SELECT ft.text FROM ${sql.identifier(table)}
    JOIN flavor_texts ft ON ft.id = flavor_text_id
    JOIN version_groups vg ON vg.id = version_group_id
    WHERE ${sql.identifier(FLAVOR_TABLES[table])} = ${id} AND lang IN (${sqlList(langChain)})
      AND vg.sort_order <= (SELECT max(sort_order) FROM version_groups
                            WHERE id IN (${sqlList(ctx.versionGroupIds)}))
    ORDER BY ${langRank(sql`lang`, langChain)}, vg.sort_order DESC LIMIT 1`)) as
    { text: string } | undefined;
  return row?.text ?? null;
}
