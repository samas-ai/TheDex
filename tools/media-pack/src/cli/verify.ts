import { readFileSync } from 'node:fs';
import {
  MEDIA_PACKS,
  mediaBaseUrl,
  mediaPackListingFile,
  type MediaPack,
} from '@thedex/data-pipeline/config';
import { listingKey, readMediaListing } from '@thedex/data-pipeline/media-listing';
import { packSources, runPool } from '../pack';

/**
 * Checks the published `cries-aac` pack against the committed listing: the published
 * listing.json must be identical, and every file must answer at its pinned URL with the
 * listed size. Run after publishing a pack (or bumping its revision in config.ts).
 */
const PACK: MediaPack = 'cries-aac';
const CONCURRENCY = 16;

const file = mediaPackListingFile(PACK);
const listing = readMediaListing(file);
if (!listing) throw new Error(`Media pack listing not found: ${file} — run pnpm media:pack`);
const errors: string[] = [];

const remoteUrl = `${MEDIA_PACKS[PACK].baseUrl}/listing.json`;
const remote = await fetch(remoteUrl);
if (!remote.ok) {
  errors.push(`GET ${remoteUrl} -> ${remote.status}`);
} else if ((await remote.text()) !== readFileSync(file, 'utf8').replaceAll('\r\n', '\n')) {
  errors.push(`${remoteUrl} differs from ${file}`);
}

let checked = 0;
for (const { source } of packSources(PACK)) {
  const entries = listing.dirs[listingKey(source.repo, source.dir)] ?? [];
  if (entries.length === 0) errors.push(`${source.style}/${source.variant}: no files listed`);
  await runPool(entries, CONCURRENCY, async ([name, bytes]) => {
    const url = `${mediaBaseUrl(source)}/${name}`;
    const res = await fetch(url, { method: 'HEAD' });
    const length = Number(res.headers.get('content-length'));
    if (!res.ok) errors.push(`HEAD ${url} -> ${res.status}`);
    else if (length !== bytes) errors.push(`${url}: ${length} bytes, listed ${bytes}`);
    checked++;
  });
  console.log(`${source.style}/${source.variant}: ${entries.length} files checked`);
}

for (const error of errors.slice(0, 50)) console.error(`  ✗ ${error}`);
console.log(`\n${checked} files at ${MEDIA_PACKS[PACK].baseUrl}: ${errors.length} errors`);
if (errors.length > 0) process.exitCode = 1;
