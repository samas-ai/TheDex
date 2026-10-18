import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  MEDIA_LISTING_FILE,
  MEDIA_REPOS,
  MEDIA_SOURCES,
  POKEAPI_CSV_DIR,
  POKEAPI_CSV_FILES,
  POKEAPI_SHA,
  type MediaRepo,
} from '../config';
import { listingKey, type MediaListing } from '../media-listing';

const CONCURRENCY = 8;
const force = process.argv.includes('--force');

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

async function writeAtomic(target: string, body: string | Buffer): Promise<void> {
  const tmp = `${target}.part`;
  await writeFile(tmp, body);
  await rename(tmp, target);
}

async function download(name: string): Promise<'cached' | 'downloaded'> {
  const target = path.join(POKEAPI_CSV_DIR, `${name}.csv`);
  if (!force && (await exists(target))) return 'cached';
  const url = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_SHA}/data/v2/csv/${name}.csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length === 0) throw new Error(`Empty response for ${name}.csv`);
  await writeAtomic(target, body);
  return 'downloaded';
}

async function fetchCsvs(): Promise<void> {
  await mkdir(POKEAPI_CSV_DIR, { recursive: true });
  const queue = [...POKEAPI_CSV_FILES];
  let downloaded = 0;
  let cached = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    for (let name = queue.shift(); name; name = queue.shift()) {
      const result = await download(name);
      if (result === 'downloaded') downloaded++;
      else cached++;
    }
  });
  await Promise.all(workers);
  console.log(
    `PokeAPI ${POKEAPI_SHA.slice(0, 7)}: ${downloaded} downloaded, ${cached} cached -> ${POKEAPI_CSV_DIR}`,
  );
}

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  size?: number;
}

/**
 * Lists the media directories through the GitHub tree API, one non-recursive tree per path
 * segment (~16 requests, well under the anonymous 60/hour limit; GITHUB_TOKEN raises it).
 */
async function fetchMediaListing(): Promise<void> {
  if (!force && (await exists(MEDIA_LISTING_FILE))) {
    console.log(`Media listing cached -> ${MEDIA_LISTING_FILE}`);
    return;
  }
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const trees = new Map<string, TreeEntry[]>();
  let requests = 0;

  const tree = async (repo: MediaRepo, sha: string): Promise<TreeEntry[]> => {
    const cached = trees.get(sha);
    if (cached) return cached;
    const url = `https://api.github.com/repos/PokeAPI/${repo}/git/trees/${sha}`;
    const res = await fetch(url, { headers });
    requests++;
    if (!res.ok) throw new Error(`GET ${url} -> ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { tree: TreeEntry[]; truncated: boolean };
    if (body.truncated) throw new Error(`Truncated tree listing: ${url}`);
    trees.set(sha, body.tree);
    return body.tree;
  };

  const dirs: MediaListing['dirs'] = {};
  // Packs (cry-aac) are listed by `pnpm media:pack`, not by the upstream repos.
  for (const source of MEDIA_SOURCES.filter((s) => !s.pack)) {
    let entries = await tree(source.repo, MEDIA_REPOS[source.repo]);
    for (const segment of source.dir.split('/')) {
      const next = entries.find((entry) => entry.path === segment && entry.type === 'tree');
      if (!next) throw new Error(`${source.repo}@${MEDIA_REPOS[source.repo]}: no ${source.dir}`);
      entries = await tree(source.repo, next.sha);
    }
    dirs[listingKey(source.repo, source.dir)] = entries
      .filter((entry) => entry.type === 'blob')
      .map((entry): [string, number] => [entry.path, entry.size ?? 0])
      .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }));
  }

  const listing: MediaListing = { repos: { ...MEDIA_REPOS }, dirs };
  await mkdir(path.dirname(MEDIA_LISTING_FILE), { recursive: true });
  await writeAtomic(MEDIA_LISTING_FILE, `${JSON.stringify(listing)}\n`);
  const files = Object.values(dirs).reduce((sum, list) => sum + list.length, 0);
  console.log(`Media listing: ${files} files, ${requests} API requests -> ${MEDIA_LISTING_FILE}`);
}

await fetchCsvs();
await fetchMediaListing();
