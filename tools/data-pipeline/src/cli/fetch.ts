import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { POKEAPI_CSV_DIR, POKEAPI_CSV_FILES, POKEAPI_SHA } from '../config';

const CONCURRENCY = 8;
const force = process.argv.includes('--force');

async function exists(file: string): Promise<boolean> {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

async function download(name: string): Promise<'cached' | 'downloaded'> {
  const target = path.join(POKEAPI_CSV_DIR, `${name}.csv`);
  if (!force && (await exists(target))) return 'cached';
  const url = `https://raw.githubusercontent.com/PokeAPI/pokeapi/${POKEAPI_SHA}/data/v2/csv/${name}.csv`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  if (body.length === 0) throw new Error(`Empty response for ${name}.csv`);
  const tmp = `${target}.part`;
  await writeFile(tmp, body);
  await rename(tmp, target);
  return 'downloaded';
}

async function main(): Promise<void> {
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

await main();
