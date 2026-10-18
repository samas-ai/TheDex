import type { BuildContext } from '../context';

/** Location Dex groups (RF06.1), in display order. Mirrors LOCATION_KINDS in @thedex/db. */
export const LOCATION_KIND_IDS = ['city', 'route', 'cave', 'water', 'building', 'area'] as const;
export type LocationKindId = (typeof LOCATION_KIND_IDS)[number];

/** Whole words of a kebab-case identifier (`kanto-route-1` → kanto, route, 1). */
const word = (words: string) => new RegExp(`(?:^|-)(?:${words})(?:-|$)`);

/**
 * Identifier rules, first match wins. PokeAPI has no location type, but names follow the
 * games' conventions ("Celadon City", "Route 1", "Mt. Moon", "Lake Verity"). Towns without
 * a suffix (Galar, Paldea) and misleading names come from data/curated/location-kinds.json.
 */
const RULES: readonly (readonly [RegExp, LocationKindId])[] = [
  [word('city|town|village'), 'city'],
  [word('gate'), 'building'],
  [word('victory-road'), 'cave'],
  [
    word(
      'route|province-area|road|path|pathway|trail|way|lane|walk|pass|passage|bridge|drawbridge',
    ),
    'route',
  ],
  [
    word(
      'cave|caves|cavern|tunnel|grotto|mine|underpass|chasm|den|chamber|well|sewers|falls|mt|mount|mountain',
    ),
    'cave',
  ],
  [word('sea|lake|bay|lagoon|underwater|pond|pool|waterhead|dam'), 'water'],
  [
    word(
      'tower|mansion|house|lab|labs|laboratory|hq|hideout|base|bldg|building|center|pokecenter|pokemart|megamart|mart|store|shop|market|mall|museum|library|hotel|castle|chateau|palace|factory|plant|ironworks|windworks|school|academy|hall|station|dome|studios|theater|subway|frigate|ship|ss|lighthouse|cafe|restaurant|villa|terminal|room|league|temple|observatory|aquarium|dojo|maison|frontier|arcade|battle-tree|day-care|secretariat',
    ),
    'building',
  ],
];

export function locationKind(
  identifier: string,
  overrides: Readonly<Record<string, LocationKindId>> = {},
): LocationKindId {
  const override = overrides[identifier];
  if (override) return override;
  return RULES.find(([pattern]) => pattern.test(identifier))?.[1] ?? 'area';
}

/** locations.location_kind from the identifier rules and the curated overrides. */
export function deriveLocationKinds(ctx: BuildContext): void {
  const overrides = ctx.curated.locationKinds;
  const rows = ctx.all<{ id: number; identifier: string }>('SELECT id, identifier FROM locations');
  const known = new Set(rows.map((row) => row.identifier));
  const unknown = Object.keys(overrides).filter((identifier) => !known.has(identifier));
  if (unknown.length > 0 && !ctx.options.allowMissingCsv) {
    throw new Error(`location-kinds.json: unknown locations ${unknown.join(', ')}`);
  }
  const update = ctx.db.prepare('UPDATE locations SET location_kind = ? WHERE id = ?');
  const counts = new Map<LocationKindId, number>();
  ctx.db.transaction(() => {
    for (const row of rows) {
      const kind = locationKind(row.identifier, overrides);
      counts.set(kind, (counts.get(kind) ?? 0) + 1);
      update.run(kind, row.id);
    }
  })();
  const summary = LOCATION_KIND_IDS.map((kind) => `${kind} ${counts.get(kind) ?? 0}`).join(', ');
  ctx.log(`  location kinds: ${summary}`);
}
