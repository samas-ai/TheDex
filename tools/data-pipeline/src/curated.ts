import { readFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { LOCATION_KIND_IDS, type LocationKindId } from './derive/locations';

const MECHANICS = ['mega', 'z', 'dynamax', 'tera'] as const;
export type Mechanic = (typeof MECHANICS)[number];

const gamesSchema = z.object({
  games: z
    .array(
      z.object({
        identifier: z.string().min(1),
        versionGroups: z.array(z.string().min(1)).min(1),
        pokedexes: z.array(z.string().min(1)),
        mechanics: z.array(z.enum(MECHANICS)),
      }),
    )
    .min(1),
});

const identifierLists = z.record(z.string(), z.array(z.string().min(1)));

const nameEntries = z.record(z.string(), z.object({ name: z.string().min(1) }));
const ptBrSchema = z.record(z.string(), nameEntries);

const aliasesSchema = z.record(z.string(), z.record(z.string(), z.array(z.string().min(1))));

const overridesSchema = z.record(z.string(), z.record(z.string(), z.string().nullable()));

/** ability identifier → language → effect outside battle (RF04.1). */
const overworldSchema = z.record(
  z.string(),
  z.record(z.string(), z.string().min(1)).refine((texts) => 'en' in texts, 'needs an "en" text'),
);

const locationKindsSchema = z.record(z.string(), z.enum(LOCATION_KIND_IDS));

export type CuratedGame = z.infer<typeof gamesSchema>['games'][number];

export interface CuratedData {
  readonly games: readonly CuratedGame[];
  /** tag → species identifiers */
  readonly speciesTags: Readonly<Record<string, readonly string[]>>;
  /** i18n table → identifier → name (pt-BR) */
  readonly ptBr: Readonly<Record<string, Readonly<Record<string, { name: string }>>>>;
  /** entity type → identifier → aliases */
  readonly searchAliases: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>;
  /** kind → PokeAPI identifier → Showdown ID (null = intentionally unmapped) */
  readonly psIdOverrides: Readonly<Record<string, Readonly<Record<string, string | null>>>>;
  /** ability identifier → language → effect outside battle */
  readonly abilityOverworld: Readonly<Record<string, Readonly<Record<string, string>>>>;
  /** location identifier → Location Dex group, where the identifier rules get it wrong */
  readonly locationKinds: Readonly<Record<string, LocationKindId>>;
}

export const CURATED_FILES = [
  'games.json',
  'species-tags.json',
  'i18n-pt-BR.json',
  'search-aliases.json',
  'ps-id-overrides.json',
  'ability-overworld.json',
  'location-kinds.json',
] as const;

/** Drops `$comment`-style keys so the JSON files can be self-documenting. */
function readJson(dir: string, file: string): unknown {
  const raw = JSON.parse(readFileSync(path.join(dir, file), 'utf8')) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('$')));
}

function parse<T>(schema: z.ZodType<T>, dir: string, file: string): T {
  const result = schema.safeParse(readJson(dir, file));
  if (!result.success) {
    throw new Error(`Invalid curated file ${file}:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function loadCurated(dir: string): CuratedData {
  return {
    games: parse(gamesSchema, dir, 'games.json').games,
    speciesTags: parse(identifierLists, dir, 'species-tags.json'),
    ptBr: parse(ptBrSchema, dir, 'i18n-pt-BR.json'),
    searchAliases: parse(aliasesSchema, dir, 'search-aliases.json'),
    psIdOverrides: parse(overridesSchema, dir, 'ps-id-overrides.json'),
    abilityOverworld: parse(overworldSchema, dir, 'ability-overworld.json'),
    locationKinds: parse(locationKindsSchema, dir, 'location-kinds.json'),
  };
}
