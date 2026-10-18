import { existsSync, readFileSync } from 'node:fs';
import { z } from 'zod';

/**
 * Directory listings of the pinned media commits: `dirs[<repo>/<dir>]` = `[file, bytes][]`.
 * Written by `pnpm data:fetch` (GitHub tree API), read by the build to fill media_assets
 * without downloading the ~25 GB sprites repository.
 */
const listingSchema = z.object({
  repos: z.record(z.string(), z.string().regex(/^[0-9a-f]{40}$/)),
  dirs: z.record(z.string(), z.array(z.tuple([z.string().min(1), z.number().int().nonnegative()]))),
});

export type MediaListing = z.infer<typeof listingSchema>;

export function listingKey(repo: string, dir: string): string {
  return `${repo}/${dir}`;
}

/** Reads and validates a listing file; null when it does not exist. */
export function readMediaListing(file: string): MediaListing | null {
  if (!existsSync(file)) return null;
  const result = listingSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
  if (!result.success) {
    throw new Error(`Invalid media listing ${file}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
