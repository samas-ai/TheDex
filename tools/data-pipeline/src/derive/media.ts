import { mediaBaseUrl, MEDIA_REPOS, MEDIA_SOURCES } from '../config';
import type { BuildContext } from '../context';
import { listingKey, readMediaListing } from '../media-listing';
import type { SqlValue } from '../values';

/**
 * media_sources + media_assets (RNF02): for each style/variant, which `<pokemon id>.<ext>`
 * files exist at the pinned sprites/cries commits and how large they are. The app builds
 * download URLs from these rows — nothing is hard-coded in the UI.
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

  const pokemonIds = new Set(
    ctx.all<{ id: number }>('SELECT id FROM pokemon').map((row) => row.id),
  );
  const sources: SqlValue[][] = [];
  const assets: SqlValue[][] = [];
  for (const source of MEDIA_SOURCES) {
    const entries = listing.dirs[listingKey(source.repo, source.dir)];
    if (!entries) throw new Error(`Media listing lacks ${source.repo}/${source.dir}`);
    sources.push([source.style, source.variant, mediaBaseUrl(source), source.format]);
    const pattern = new RegExp(`^(\\d+)\\.${source.format}$`);
    for (const [name, bytes] of entries) {
      const id = Number(pattern.exec(name)?.[1]);
      if (pokemonIds.has(id)) assets.push([id, source.style, source.variant, name, bytes]);
    }
  }
  ctx.insert('media_sources', ['style', 'variant', 'base_url', 'format'], sources);
  const inserted = ctx.insert(
    'media_assets',
    ['pokemon_id', 'style', 'variant', 'path', 'bytes'],
    assets,
  );
  ctx.log(`  media_assets: ${inserted} files in ${sources.length} sources`);
}
