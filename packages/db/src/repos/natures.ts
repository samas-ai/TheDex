import { sql } from 'drizzle-orm';
import { pickI18n } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';

/** One of the 25 natures (RF07.2). Neutral natures have no stat or flavor preference. */
export interface NatureEntry extends NamedEntity {
  /** Stat raised by 10% (null for neutral natures). */
  readonly increased: NamedEntity | null;
  /** Stat lowered by 10% (null for neutral natures). */
  readonly decreased: NamedEntity | null;
  /** Berry flavor it likes / hates (null for neutral natures). */
  readonly likes: NamedEntity | null;
  readonly hates: NamedEntity | null;
  /** In-game index: row (raised stat) × 5 + column (lowered stat), stats in game order. */
  readonly gameIndex: number;
}

/** Natures in game order (Hardy, Lonely, Brave…: row = raised stat, column = lowered stat). */
export async function listNatures(
  db: AnySQLiteDatabase,
  ctx: Pick<GameContext, 'langChain'>,
): Promise<NatureEntry[]> {
  const { langChain } = ctx;
  const name = (table: string, idColumn: string, id: string) =>
    pickI18n(table, idColumn, sql.raw(id), 'name', langChain);
  const rows = (await db.all(sql`
    SELECT n.id, n.identifier, n.game_index,
      COALESCE(${name('nature_i18n', 'nature_id', 'n.id')}, n.identifier) AS name,
      up.id AS up_id, up.identifier AS up, ${name('stat_i18n', 'stat_id', 'up.id')} AS up_name,
      down.id AS down_id, down.identifier AS down, ${name('stat_i18n', 'stat_id', 'down.id')} AS down_name,
      likes.id AS likes_id, likes.identifier AS likes, ${name('flavor_i18n', 'flavor_id', 'likes.id')} AS likes_name,
      hates.id AS hates_id, hates.identifier AS hates, ${name('flavor_i18n', 'flavor_id', 'hates.id')} AS hates_name
    FROM natures n
    JOIN stats up ON up.id = n.increased_stat_id
    JOIN stats down ON down.id = n.decreased_stat_id
    JOIN flavors likes ON likes.id = n.likes_flavor_id
    JOIN flavors hates ON hates.id = n.hates_flavor_id
    ORDER BY n.game_index`)) as {
    id: number;
    identifier: string;
    game_index: number;
    name: string;
    up_id: number;
    up: string;
    up_name: string | null;
    down_id: number;
    down: string;
    down_name: string | null;
    likes_id: number;
    likes: string;
    likes_name: string | null;
    hates_id: number;
    hates: string;
    hates_name: string | null;
  }[];
  return rows.map((row) => {
    const neutral = row.up_id === row.down_id;
    return {
      id: row.id,
      identifier: row.identifier,
      name: row.name,
      increased: neutral
        ? null
        : { id: row.up_id, identifier: row.up, name: row.up_name ?? row.up },
      decreased: neutral
        ? null
        : { id: row.down_id, identifier: row.down, name: row.down_name ?? row.down },
      likes: neutral
        ? null
        : { id: row.likes_id, identifier: row.likes, name: row.likes_name ?? row.likes },
      hates: neutral
        ? null
        : { id: row.hates_id, identifier: row.hates, name: row.hates_name ?? row.hates },
      gameIndex: row.game_index,
    };
  });
}
