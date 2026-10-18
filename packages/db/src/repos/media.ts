import { sql } from 'drizzle-orm';
import { sqlList } from '../sql';
import type { AnySQLiteDatabase } from '../types';

// --- Game DB: what can be downloaded (media_sources + media_assets) ---------------------

/** Sprite styles the user can pick (`settings.sprite_style`, RNF04). */
export const SPRITE_STYLES = ['official', 'pixel', '3d', 'home'] as const;
export type SpriteStyle = (typeof SPRITE_STYLES)[number];
/** Media style of Pokémon cries (`.ogg`: Vorbis or MP3). */
export const CRY_STYLE = 'cry';
/** The same cries transcoded to AAC (`.m4a`) for iOS, which cannot decode `.ogg`. */
export const CRY_AAC_STYLE = 'cry-aac';
/** Bag icons of the Item Dex (RF05.2): `item_icons`, one file per item. */
export const ITEM_ICON_STYLE = 'item';
const ITEM_ICON_VARIANT = 'default';

export interface MediaSource {
  readonly style: string;
  readonly variant: string;
  readonly baseUrl: string;
  readonly format: string;
}

export interface MediaAsset {
  readonly pokemonId: number;
  readonly style: string;
  readonly variant: string;
  /** File name relative to the source's base URL. */
  readonly path: string;
  readonly bytes: number | null;
}

export function isSpriteStyle(value: unknown): value is SpriteStyle {
  return typeof value === 'string' && (SPRITE_STYLES as readonly string[]).includes(value);
}

/** Download URL of an asset. */
export function mediaUrl(source: Pick<MediaSource, 'baseUrl'>, asset: Pick<MediaAsset, 'path'>) {
  return `${source.baseUrl}/${asset.path}`;
}

/** Stable cache key of an asset (`media_cache.key`), e.g. `official/shiny/25`. */
export function mediaCacheKey(asset: Pick<MediaAsset, 'style' | 'variant' | 'pokemonId'>) {
  return `${asset.style}/${asset.variant}/${asset.pokemonId}`;
}

export async function getMediaSources(db: AnySQLiteDatabase): Promise<MediaSource[]> {
  const rows = (await db.all(
    sql`SELECT style, variant, base_url, format FROM media_sources ORDER BY style, variant`,
  )) as { style: string; variant: string; base_url: string; format: string }[];
  return rows.map((row) => ({
    style: row.style,
    variant: row.variant,
    baseUrl: row.base_url,
    format: row.format,
  }));
}

interface AssetRow {
  pokemon_id: number;
  style: string;
  variant: string;
  path: string;
  bytes: number | null;
}

const toAsset = (row: AssetRow): MediaAsset => ({
  pokemonId: row.pokemon_id,
  style: row.style,
  variant: row.variant,
  path: row.path,
  bytes: row.bytes,
});

/** Every downloadable file of one variety (all styles and variants). */
export async function getPokemonMedia(
  db: AnySQLiteDatabase,
  pokemonId: number,
): Promise<MediaAsset[]> {
  const rows = (await db.all(sql`
    SELECT pokemon_id, style, variant, path, bytes FROM media_assets
    WHERE pokemon_id = ${pokemonId} ORDER BY style, variant`)) as AssetRow[];
  return rows.map(toAsset);
}

/** Assets of the given styles ("download all media packs", RNF02). */
export async function listMediaAssets(
  db: AnySQLiteDatabase,
  styles: readonly string[],
): Promise<MediaAsset[]> {
  const rows = (await db.all(sql`
    SELECT pokemon_id, style, variant, path, bytes FROM media_assets
    WHERE style IN (${sqlList(styles)}) ORDER BY pokemon_id, style, variant`)) as AssetRow[];
  return rows.map(toAsset);
}

export interface MediaPackSize {
  readonly style: string;
  readonly files: number;
  readonly bytes: number;
}

/** File count and download size per style, item icons included (Settings → media packs). */
export async function getMediaPackSizes(db: AnySQLiteDatabase): Promise<MediaPackSize[]> {
  const rows = (await db.all(sql`
    SELECT style, files, bytes FROM (
      SELECT style, count(*) AS files, coalesce(sum(bytes), 0) AS bytes
      FROM media_assets GROUP BY style
      UNION ALL
      SELECT ${ITEM_ICON_STYLE}, count(*), coalesce(sum(bytes), 0) FROM item_icons
    ) WHERE files > 0 ORDER BY style`)) as MediaPackSize[];
  return rows.map((row) => ({ style: row.style, files: row.files, bytes: row.bytes }));
}

// --- Item icons (RF05.2) ----------------------------------------------------------------

/** A downloadable item icon. */
export interface ItemIcon {
  readonly itemId: number;
  /** File name relative to the `item` source's base URL (e.g. `master-ball.png`). */
  readonly path: string;
  readonly bytes: number | null;
}

/** Cache key of an item icon in `media_cache` (`item/default/<item id>`). */
export function itemIconCacheKey(itemId: number): string {
  return `${ITEM_ICON_STYLE}/${ITEM_ICON_VARIANT}/${itemId}`;
}

/** Media source of item icons (null with a data DB that has none). */
export function itemIconSource(sources: readonly MediaSource[]): MediaSource | null {
  return (
    sources.find(
      (source) => source.style === ITEM_ICON_STYLE && source.variant === ITEM_ICON_VARIANT,
    ) ?? null
  );
}

export async function getItemIcon(db: AnySQLiteDatabase, itemId: number): Promise<ItemIcon | null> {
  const row = (await db.get(
    sql`SELECT item_id, path, bytes FROM item_icons WHERE item_id = ${itemId}`,
  )) as { item_id: number; path: string; bytes: number | null } | undefined;
  return row ? { itemId: row.item_id, path: row.path, bytes: row.bytes } : null;
}

/** Every item icon ("download all media packs", RNF02). */
export async function listItemIcons(db: AnySQLiteDatabase): Promise<ItemIcon[]> {
  const rows = (await db.all(
    sql`SELECT item_id, path, bytes FROM item_icons ORDER BY item_id`,
  )) as { item_id: number; path: string; bytes: number | null }[];
  return rows.map((row) => ({ itemId: row.item_id, path: row.path, bytes: row.bytes }));
}

// --- User DB: what is on this device (media_cache) --------------------------------------

export interface MediaCacheEntry {
  readonly key: string;
  readonly kind: string;
  readonly url: string;
  readonly localUri: string;
  readonly bytes: number;
  readonly etag: string | null;
  readonly fetchedAt: number;
  readonly lastAccessAt: number;
}

interface CacheRow {
  key: string;
  kind: string;
  url: string;
  local_uri: string;
  bytes: number;
  etag: string | null;
  fetched_at: number;
  last_access_at: number;
}

const toEntry = (row: CacheRow): MediaCacheEntry => ({
  key: row.key,
  kind: row.kind,
  url: row.url,
  localUri: row.local_uri,
  bytes: row.bytes,
  etag: row.etag,
  fetchedAt: row.fetched_at,
  lastAccessAt: row.last_access_at,
});

export async function getMediaCacheEntry(
  db: AnySQLiteDatabase,
  key: string,
): Promise<MediaCacheEntry | null> {
  const row = (await db.get(sql`
    SELECT key, kind, url, local_uri, bytes, etag, fetched_at, last_access_at
    FROM media_cache WHERE key = ${key}`)) as CacheRow | undefined;
  return row ? toEntry(row) : null;
}

/** Keys already cached, optionally restricted to a kind (style). */
export async function listMediaCacheKeys(
  db: AnySQLiteDatabase,
  kind?: string,
): Promise<Set<string>> {
  const where = kind === undefined ? sql`` : sql` WHERE kind = ${kind}`;
  const rows = (await db.all(sql`SELECT key FROM media_cache${where}`)) as { key: string }[];
  return new Set(rows.map((row) => row.key));
}

export async function putMediaCacheEntry(
  db: AnySQLiteDatabase,
  entry: MediaCacheEntry,
): Promise<void> {
  await db.run(sql`
    INSERT INTO media_cache (key, kind, url, local_uri, bytes, etag, fetched_at, last_access_at)
    VALUES (${entry.key}, ${entry.kind}, ${entry.url}, ${entry.localUri}, ${entry.bytes},
      ${entry.etag}, ${entry.fetchedAt}, ${entry.lastAccessAt})
    ON CONFLICT (key) DO UPDATE SET kind = excluded.kind, url = excluded.url,
      local_uri = excluded.local_uri, bytes = excluded.bytes, etag = excluded.etag,
      fetched_at = excluded.fetched_at, last_access_at = excluded.last_access_at`);
}

export async function touchMediaCacheEntry(
  db: AnySQLiteDatabase,
  key: string,
  at: number,
): Promise<void> {
  await db.run(sql`UPDATE media_cache SET last_access_at = ${at} WHERE key = ${key}`);
}

/** Deletes the given entries, or every entry when `keys` is omitted. */
export async function deleteMediaCacheEntries(
  db: AnySQLiteDatabase,
  keys?: readonly string[],
): Promise<void> {
  if (keys === undefined) {
    await db.run(sql`DELETE FROM media_cache`);
  } else if (keys.length > 0) {
    await db.run(sql`DELETE FROM media_cache WHERE key IN (${sqlList(keys)})`);
  }
}

export interface MediaCacheStats {
  readonly files: number;
  readonly bytes: number;
}

export async function getMediaCacheStats(db: AnySQLiteDatabase): Promise<MediaCacheStats> {
  const row = (await db.get(
    sql`SELECT count(*) AS files, coalesce(sum(bytes), 0) AS bytes FROM media_cache`,
  )) as MediaCacheStats;
  return { files: row.files, bytes: row.bytes };
}
