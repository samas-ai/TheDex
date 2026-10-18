import {
  mediaBaseUrl,
  mediaPackListingFile,
  MEDIA_REPOS,
  MEDIA_SOURCES,
  type MediaPack,
  type MediaSourceConfig,
} from '../config';
import type { BuildContext } from '../context';
import { listingKey, readMediaListing, type MediaListing } from '../media-listing';
import type { SqlValue } from '../values';

/**
 * media_sources + media_assets (RNF02): for each style/variant, which `<pokemon id>.<ext>`
 * files exist at the pinned sprites/cries commits and how large they are; item_icons does the
 * same for `<item identifier>.png` (RF05.2). The app builds download URLs from these rows —
 * nothing is hard-coded in the UI. Packs hosted by TheDex (cry-aac) come from their committed
 * listing (`pnpm media:pack`).
 */
export function deriveMedia(ctx: BuildContext): void {
  const file = ctx.options.mediaListingFile;
  const listing = file ? readMediaListing(file) : null;
  if (!listing) {
    if (!ctx.options.allowMissingCsv) {
      throw new Error(`Media listing not found: ${file ?? '(none)'} — run pnpm data:fetch`);
    }
    ctx.log('  media: no listing (skipped)');
    return;
  }
  for (const [repo, sha] of Object.entries(MEDIA_REPOS)) {
    if (listing.repos[repo] !== sha) {
      throw new Error(`Media listing is for ${repo}@${listing.repos[repo]}, expected ${sha}`);
    }
  }

  const packs = new Map<MediaPack, MediaListing>();
  const listingOf = (source: MediaSourceConfig): MediaListing => {
    if (!source.pack) return listing;
    let pack = packs.get(source.pack);
    if (!pack) {
      const packFile = mediaPackListingFile(source.pack, ctx.options.mediaPackDir);
      pack = readMediaListing(packFile) ?? undefined;
      if (!pack) throw new Error(`Media pack listing not found: ${packFile} — run pnpm media:pack`);
      packs.set(source.pack, pack);
    }
    const sha = MEDIA_REPOS[source.repo];
    if (pack.repos[source.repo] !== sha) {
      throw new Error(
        `Media pack ${source.pack} was built from ${source.repo}@${pack.repos[source.repo]}, ` +
          `expected ${sha} — run pnpm media:pack and publish it again`,
      );
    }
    return pack;
  };

  const pokemonIds = new Set(
    ctx.all<{ id: number }>('SELECT id FROM pokemon').map((row) => row.id),
  );
  const itemIds = new Map(
    ctx
      .all<{ id: number; identifier: string }>('SELECT id, identifier FROM items')
      .map((row) => [row.identifier, row.id]),
  );
  const sources: SqlValue[][] = [];
  const assets: SqlValue[][] = [];
  const icons: SqlValue[][] = [];
  for (const source of MEDIA_SOURCES) {
    const entries = listingOf(source).dirs[listingKey(source.repo, source.dir)];
    if (!entries) {
      throw new Error(`Media listing lacks ${source.repo}/${source.dir} (${source.style})`);
    }
    sources.push([source.style, source.variant, mediaBaseUrl(source), source.format]);
    const extension = `.${source.format}`;
    for (const [name, bytes] of entries) {
      if (!name.endsWith(extension)) continue;
      const stem = name.slice(0, -extension.length);
      if (source.entity === 'item') {
        const id = itemIds.get(stem);
        if (id !== undefined) icons.push([id, name, bytes]);
      } else if (/^\d+$/.test(stem) && pokemonIds.has(Number(stem))) {
        assets.push([Number(stem), source.style, source.variant, name, bytes]);
      }
    }
  }
  ctx.insert('media_sources', ['style', 'variant', 'base_url', 'format'], sources);
  const inserted = ctx.insert(
    'media_assets',
    ['pokemon_id', 'style', 'variant', 'path', 'bytes'],
    assets,
  );
  const iconCount = ctx.insert('item_icons', ['item_id', 'path', 'bytes'], icons);
  ctx.log(
    `  media_assets: ${inserted} files, item_icons: ${iconCount}, in ${sources.length} sources`,
  );
}
