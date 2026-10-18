import { execFile } from 'node:child_process';
import { mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  MEDIA_LISTING_FILE,
  MEDIA_REPOS,
  mediaBaseUrl,
  mediaPackListingFile,
  type MediaPack,
} from '@thedex/data-pipeline/config';
import { formatMediaListing, readMediaListing } from '@thedex/data-pipeline/media-listing';
import {
  aacArgs,
  DOWNLOAD_DIR,
  outputName,
  PACK_DIST_DIR,
  packInputs,
  packListing,
  packReadme,
  packSources,
  runPool,
} from '../pack';

/**
 * Builds the `cries-aac` pack (iOS cries): downloads `cries/pokemon/{latest,legacy}` at the
 * pinned CRIES_SHA, transcodes each file with ffmpeg and writes, under dist/cries-aac/, the
 * tree to publish (files + README.md + listing.json). The listing is also written to
 * data/generated/media-packs/, which the data pipeline reads. `--force` redoes everything.
 */
const PACK: MediaPack = 'cries-aac';
const DOWNLOAD_CONCURRENCY = 8;
const force = process.argv.includes('--force');
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const run = promisify(execFile);

async function sizeOf(file: string): Promise<number | null> {
  try {
    return (await stat(file)).size;
  } catch {
    return null;
  }
}

const listing = readMediaListing(MEDIA_LISTING_FILE);
if (!listing)
  throw new Error(`Media listing not found: ${MEDIA_LISTING_FILE} — run pnpm data:fetch`);
const ffmpegVersion = (await run(ffmpeg, ['-hide_banner', '-version'])).stdout.split(/\r?\n/)[0]!;
console.log(`${ffmpegVersion}\n`);

const outRoot = path.join(PACK_DIST_DIR, PACK);
if (force) await rm(outRoot, { recursive: true, force: true });
const sources = packSources(PACK);
const built: { source: (typeof sources)[number]['source']; entries: [string, number][] }[] = [];
let upstreamBytes = 0;

for (const { source, upstream } of sources) {
  const inputs = packInputs(listing, upstream);
  const sha = MEDIA_REPOS[upstream.repo];
  const inDir = path.join(DOWNLOAD_DIR, `${upstream.repo}-${sha.slice(0, 12)}`, upstream.dir);
  const outDir = path.join(outRoot, source.dir);
  await mkdir(inDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  let downloaded = 0;
  await runPool(inputs, DOWNLOAD_CONCURRENCY, async ([name, bytes]) => {
    const target = path.join(inDir, name);
    if ((await sizeOf(target)) === bytes) return;
    const url = `${mediaBaseUrl(upstream)}/${name}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    if (body.length !== bytes) throw new Error(`${url}: ${body.length} bytes, listed ${bytes}`);
    await writeFile(`${target}.part`, body);
    await rename(`${target}.part`, target);
    downloaded++;
  });

  const entries: [string, number][] = [];
  let transcoded = 0;
  await runPool(inputs, availableParallelism(), async ([name]) => {
    const output = path.join(outDir, outputName(name, source.format));
    let size = await sizeOf(output);
    if (size === null || size === 0) {
      const tmp = `${output}.part`;
      try {
        await run(ffmpeg, aacArgs(path.join(inDir, name), tmp));
      } catch (error) {
        throw new Error(`ffmpeg failed on ${upstream.dir}/${name}`, { cause: error });
      }
      await rename(tmp, output);
      size = (await stat(output)).size;
      transcoded++;
    }
    entries.push([path.basename(output), size]);
  });

  // Drop leftovers (e.g. files removed upstream after a CRIES_SHA bump) so they are not published.
  const expected = new Set(entries.map(([name]) => name));
  for (const file of await readdir(outDir)) {
    if (!expected.has(file)) await rm(path.join(outDir, file), { force: true });
  }

  built.push({ source, entries });
  upstreamBytes += inputs.reduce((sum, [, bytes]) => sum + bytes, 0);
  console.log(
    `${source.style}/${source.variant}: ${entries.length} files ` +
      `(${downloaded} downloaded, ${transcoded} transcoded) -> ${outDir}`,
  );
}

const packed = packListing(built);
const listingText = formatMediaListing(packed);
const readme = packReadme({
  pack: PACK,
  ffmpegVersion,
  sources,
  listing: packed,
  upstreamUrl: (upstream) => mediaBaseUrl(upstream),
});
await writeFile(path.join(outRoot, 'listing.json'), listingText);
await writeFile(path.join(outRoot, 'README.md'), readme);
// Published as is: no line-ending conversion of the listing, README or audio files.
await writeFile(path.join(outRoot, '.gitattributes'), '* -text\n');
const committed = mediaPackListingFile(PACK);
await mkdir(path.dirname(committed), { recursive: true });
await writeFile(committed, listingText);

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const packBytes = built.reduce(
  (sum, { entries }) => sum + entries.reduce((s, [, bytes]) => s + bytes, 0),
  0,
);
console.log(
  `\n${PACK}: ${built.reduce((n, b) => n + b.entries.length, 0)} files, ${mb(packBytes)} ` +
    `(upstream ${mb(upstreamBytes)}, ×${(packBytes / upstreamBytes).toFixed(2)})` +
    `\n  publish: ${outRoot}\n  listing: ${committed}`,
);
