import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import {
  chartMultiplier,
  isTypeName,
  legacyDamageClass,
  NATURES,
  isNatureName,
  type Generation,
} from '@thedex/engine';
import {
  getAbilityHolders,
  getEvolutionChain,
  getLocationEncounters,
  getMoveDetail,
  getMoveLearners,
  getPokemonMoves,
  listMoves,
  listNatures,
  listPokedex,
  resolveGameContext,
  searchQuery,
  type EvolutionMethod,
} from '@thedex/db';
import { mediaBaseUrl, MEDIA_SOURCES } from './config';
import { readCsv } from './csv';
import { PT_BR_REQUIRED } from './derive/curated';
import { checkHotQueryPlans, openAppLikeConnection } from './query-plans';

export interface ValidationReport {
  readonly errors: string[];
  readonly warnings: string[];
  readonly passed: string[];
}

export interface ValidateOptions {
  readonly dbFile: string;
  /** PokeAPI CSV directory, for the engine cross-checks (skipped when absent). */
  readonly csvDir?: string;
  readonly sizeWarnBytes: number;
  readonly sizeFailBytes: number;
}

type Db = Database.Database;

function scalar<T = number>(db: Db, sql: string, ...params: unknown[]): T {
  return db
    .prepare(sql)
    .pluck()
    .get(...(params as never[])) as T;
}

function typesOf(db: Db, pokemonId: number, gen: number): string {
  return (
    db
      .prepare(
        `SELECT t.identifier FROM pokemon_types_by_gen pt JOIN types t ON t.id = pt.type_id
         WHERE pt.pokemon_id = ? AND pt.generation_id = ? ORDER BY pt.slot`,
      )
      .pluck()
      .all(pokemonId, gen) as string[]
  ).join('/');
}

function moveAt(db: Db, move: string, versionGroup: string) {
  return db
    .prepare(
      `SELECT t.identifier AS type, dc.identifier AS damage_class, ms.power
       FROM move_stats_by_vg ms
       JOIN moves m ON m.id = ms.move_id JOIN version_groups vg ON vg.id = ms.version_group_id
       JOIN types t ON t.id = ms.type_id JOIN move_damage_classes dc ON dc.id = ms.damage_class_id
       WHERE m.identifier = ? AND vg.identifier = ?`,
    )
    .get(move, versionGroup) as { type: string; damage_class: string; power: number } | undefined;
}

export async function validateDatabase(options: ValidateOptions): Promise<ValidationReport> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const passed: string[] = [];
  const check = (name: string, ok: boolean, detail = '') => {
    if (ok) passed.push(name);
    else errors.push(detail ? `${name}: ${detail}` : name);
  };

  if (!existsSync(options.dbFile)) {
    return {
      errors: [`Database not found: ${options.dbFile} (run pnpm data:build)`],
      warnings,
      passed,
    };
  }
  const db = new Database(options.dbFile, { readonly: true });
  try {
    // --- Integrity -------------------------------------------------------------------
    check('integrity_check', scalar<string>(db, 'PRAGMA integrity_check') === 'ok');
    const fkViolations = db.pragma('foreign_key_check') as { table: string; parent: string }[];
    const fkSummary = new Map<string, number>();
    for (const v of fkViolations) {
      const key = `${v.table} -> ${v.parent}`;
      fkSummary.set(key, (fkSummary.get(key) ?? 0) + 1);
    }
    check(
      'foreign_key_check',
      fkViolations.length === 0,
      [...fkSummary].map(([key, count]) => `${key} (${count})`).join(', '),
    );

    // --- Minimum counts (main series only) -----------------------------------------------
    const minimums: [string, string, number][] = [
      ['species', 'SELECT count(*) FROM pokemon_species', 1025],
      ['pokemon varieties', 'SELECT count(*) FROM pokemon', 1300],
      ['main-series moves', 'SELECT count(*) FROM moves WHERE id < 10000', 900],
      ['main-series abilities', 'SELECT count(*) FROM abilities WHERE is_main_series = 1', 300],
      ['items', 'SELECT count(*) FROM items', 2000],
      ['learnset rows', 'SELECT count(*) FROM pokemon_moves', 500_000],
      ['games', 'SELECT count(*) FROM games', 27],
      ['search terms', 'SELECT count(*) FROM search_terms', 50_000],
      ['natures', 'SELECT count(*) FROM natures', 25],
    ];
    for (const [name, sql, minimum] of minimums) {
      const count = scalar(db, sql);
      check(`count ${name} ≥ ${minimum}`, count >= minimum, `got ${count}`);
    }

    // --- Spot facts -------------------------------------------------------------------
    const facts: [string, unknown, unknown][] = [
      ['Bulbasaur is grass/poison (Gen 9)', typesOf(db, 1, 9), 'grass/poison'],
      ['Clefairy is normal in Gen 5', typesOf(db, 35, 5), 'normal'],
      ['Clefairy is fairy in Gen 6', typesOf(db, 35, 6), 'fairy'],
      ['Magnemite is electric in Gen 1', typesOf(db, 81, 1), 'electric'],
      ['Magnemite is electric/steel in Gen 2', typesOf(db, 81, 2), 'electric/steel'],
      [
        'Charizard BST 534',
        scalar(
          db,
          'SELECT bst FROM pokemon_stats_by_gen WHERE pokemon_id = 6 AND generation_id = 9',
        ),
        534,
      ],
      [
        'Pikachu Defense 30 in Gen 5',
        scalar(
          db,
          'SELECT defense FROM pokemon_stats_by_gen WHERE pokemon_id = 25 AND generation_id = 5',
        ),
        30,
      ],
      [
        'Pikachu Defense 40 in Gen 6',
        scalar(
          db,
          'SELECT defense FROM pokemon_stats_by_gen WHERE pokemon_id = 25 AND generation_id = 6',
        ),
        40,
      ],
      [
        'Mewtwo Special 154 in Gen 1',
        scalar(
          db,
          'SELECT special FROM pokemon_stats_by_gen WHERE pokemon_id = 150 AND generation_id = 1',
        ),
        154,
      ],
      [
        'Shedinja base HP 1',
        scalar(
          db,
          'SELECT hp FROM pokemon_stats_by_gen WHERE pokemon_id = 292 AND generation_id = 9',
        ),
        1,
      ],
      [
        'Gengar has Levitate in Gen 6',
        scalar<string>(
          db,
          `SELECT a.identifier FROM pokemon_abilities_by_gen pa JOIN abilities a ON a.id = pa.ability_id
           WHERE pa.pokemon_id = 94 AND pa.generation_id = 6 AND pa.slot = 1`,
        ),
        'levitate',
      ],
      [
        'Gengar has Cursed Body in Gen 7',
        scalar<string>(
          db,
          `SELECT a.identifier FROM pokemon_abilities_by_gen pa JOIN abilities a ON a.id = pa.ability_id
           WHERE pa.pokemon_id = 94 AND pa.generation_id = 7 AND pa.slot = 1`,
        ),
        'cursed-body',
      ],
      [
        'Bulbasaur has no hidden ability in Gen 4',
        scalar(
          db,
          'SELECT count(*) FROM pokemon_abilities_by_gen WHERE pokemon_id = 1 AND generation_id = 4 AND is_hidden = 1',
        ),
        0,
      ],
      [
        'No abilities before Gen 3',
        scalar(db, 'SELECT count(*) FROM pokemon_abilities_by_gen WHERE generation_id < 3'),
        0,
      ],
      [
        'Thunderbolt is special in Emerald',
        moveAt(db, 'thunderbolt', 'emerald')?.damage_class,
        'special',
      ],
      [
        'Karate Chop is normal-type in Red/Blue',
        moveAt(db, 'karate-chop', 'red-blue')?.type,
        'normal',
      ],
      ['Bite is normal-type in Red/Blue', moveAt(db, 'bite', 'red-blue')?.type, 'normal'],
      [
        'Bite is special in Gold/Silver (Dark was special)',
        moveAt(db, 'bite', 'gold-silver')?.damage_class,
        'special',
      ],
      [
        'Bite is physical in Diamond/Pearl',
        moveAt(db, 'bite', 'diamond-pearl')?.damage_class,
        'physical',
      ],
      [
        'Pikachu learns Thunderbolt in Scarlet/Violet',
        scalar(
          db,
          `SELECT count(*) > 0 FROM pokemon_moves pm JOIN game_version_groups g ON g.version_group_id = pm.version_group_id
           JOIN games ga ON ga.id = g.game_id WHERE pm.pokemon_id = 25 AND pm.move_id = 85 AND ga.identifier = 'scarlet-violet'`,
        ),
        1,
      ],
      [
        'Fire is "Fogo" in pt-BR',
        scalar<string>(db, `SELECT name FROM type_i18n WHERE type_id = 10 AND lang = 'pt-BR'`),
        'Fogo',
      ],
      [
        'Special Attack is "Atq. Esp." in pt-BR',
        scalar<string>(db, `SELECT name FROM stat_i18n WHERE stat_id = 4 AND lang = 'pt-BR'`),
        'Atq. Esp.',
      ],
      [
        'Charizard Showdown ID',
        scalar<string>(db, 'SELECT ps_id FROM pokemon WHERE id = 6'),
        'charizard',
      ],
      [
        'Mega Charizard X Showdown name',
        scalar<string>(db, `SELECT ps_name FROM pokemon WHERE identifier = 'charizard-mega-x'`),
        'Charizard-Mega-X',
      ],
      [
        'U-turn Showdown name',
        scalar<string>(db, `SELECT ps_name FROM moves WHERE identifier = 'u-turn'`),
        'U-turn',
      ],
      [
        'Flamethrower Max Move power 130',
        scalar(db, `SELECT max_power FROM moves WHERE identifier = 'flamethrower'`),
        130,
      ],
      [
        'Mega Charizard X changes from Charizard with Charizardite X',
        scalar<string>(
          db,
          `SELECT i.identifier FROM form_changes fc JOIN pokemon p ON p.id = fc.to_pokemon_id
           JOIN items i ON i.id = fc.item_id WHERE p.identifier = 'charizard-mega-x' AND fc.from_pokemon_id = 6`,
        ),
        'charizardite-x',
      ],
      [
        'Paradox tag on Flutter Mane',
        scalar(db, `SELECT count(*) FROM species_tags WHERE species_id = 987 AND tag = 'paradox'`),
        1,
      ],
    ];
    for (const [name, actual, expected] of facts) {
      check(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
    }

    // pt-BR completeness (18 types, 25 natures, 6 stats).
    for (const [table, { entityTable, idColumn, where }] of Object.entries(PT_BR_REQUIRED)) {
      const missing = scalar(
        db,
        `SELECT count(*) FROM "${entityTable}" e WHERE ${where} AND NOT EXISTS (
           SELECT 1 FROM "${table}" i WHERE i.${idColumn} = e.id AND i.lang = 'pt-BR')`,
      );
      check(`pt-BR ${table} complete`, missing === 0, `${missing} missing`);
    }

    // --- Search ordering (RNF07) -------------------------------------------------------
    const search = await searchQuery(
      drizzle(db),
      'char',
      { langChain: ['en'] },
      {
        entityTypes: ['pokemon'],
        limitPerType: 20,
      },
    );
    const names = search.hits.map((hit) => hit.name);
    const prefixNames = ['Charmander', 'Charmeleon', 'Charizard', 'Charjabug', 'Charcadet'];
    const chimchar = names.indexOf('Chimchar');
    const prefixPositions = prefixNames.map((name) => names.indexOf(name));
    check(
      'search "char" ranks prefix matches before Chimchar',
      chimchar >= 0 && prefixPositions.every((p) => p >= 0 && p < chimchar),
      names.join(', '),
    );
    check(
      'search "char" lists prefix matches in national order',
      prefixPositions.every((p, i) => i === 0 || p > prefixPositions[i - 1]!),
      names.join(', '),
    );

    // --- Phase 2: media manifest, form kinds, profile repositories ------------------------
    const mediaMinimums: [string, string, number][] = [
      ['media sources', 'SELECT count(*) FROM media_sources', MEDIA_SOURCES.length],
      [
        'official artwork files',
        `SELECT count(*) FROM media_assets WHERE style = 'official' AND variant = 'default'`,
        1300,
      ],
      [
        'cry files',
        `SELECT count(*) FROM media_assets WHERE style = 'cry' AND variant = 'latest'`,
        1300,
      ],
      [
        'iOS (AAC) cry files',
        `SELECT count(*) FROM media_assets WHERE style = 'cry-aac' AND variant = 'latest'`,
        1300,
      ],
    ];
    for (const [name, sql, minimum] of mediaMinimums) {
      const count = scalar(db, sql);
      check(`count ${name} ≥ ${minimum}`, count >= minimum, `got ${count}`);
    }
    const formKind = (identifier: string) =>
      scalar<string>(db, 'SELECT form_kind FROM pokemon_forms WHERE identifier = ?', identifier);
    const baseUrls = db
      .prepare('SELECT style, variant, base_url AS baseUrl FROM media_sources')
      .all() as { style: string; variant: string; baseUrl: string }[];
    const unpinned = MEDIA_SOURCES.filter(
      (source) =>
        baseUrls.find((row) => row.style === source.style && row.variant === source.variant)
          ?.baseUrl !== mediaBaseUrl(source),
    ).map((source) => `${source.style}/${source.variant}`);
    check(
      'Every media source matches its configured URL',
      unpinned.length === 0 && baseUrls.length === MEDIA_SOURCES.length,
      unpinned.join(', '),
    );
    const mutable = baseUrls.filter((row) => !/\/[0-9a-f]{40}\//.test(row.baseUrl));
    check(
      'Every media URL is pinned to a commit (immutable)',
      mutable.length === 0,
      mutable.map((row) => `${row.style}/${row.variant}: ${row.baseUrl}`).join(', '),
    );
    const crySets = (a: string, b: string) =>
      scalar(
        db,
        `SELECT count(*) FROM media_assets x WHERE x.style = ? AND NOT EXISTS (
           SELECT 1 FROM media_assets y
           WHERE y.style = ? AND y.variant = x.variant AND y.pokemon_id = x.pokemon_id)`,
        a,
        b,
      );
    const phase2Facts: [string, unknown, unknown][] = [
      ['Every .ogg cry has an AAC (iOS) counterpart', crySets('cry', 'cry-aac'), 0],
      ['Every AAC (iOS) cry has an .ogg counterpart', crySets('cry-aac', 'cry'), 0],
      [
        'Pikachu has a legacy AAC cry',
        scalar<string>(
          db,
          `SELECT path FROM media_assets WHERE pokemon_id = 25 AND style = 'cry-aac' AND variant = 'legacy'`,
        ),
        '25.m4a',
      ],
      [
        'AAC cries are served as m4a',
        scalar<string>(
          db,
          `SELECT group_concat(DISTINCT format) FROM media_sources WHERE style = 'cry-aac'`,
        ),
        'm4a',
      ],
      [
        'Pikachu has a shiny official artwork',
        scalar<string>(
          db,
          `SELECT path FROM media_assets WHERE pokemon_id = 25 AND style = 'official' AND variant = 'shiny'`,
        ),
        '25.png',
      ],
      ['Mega Charizard X form kind', formKind('charizard-mega-x'), 'mega'],
      ['Alolan Raichu form kind', formKind('raichu-alola'), 'regional_alola'],
      ['Gigantamax Pikachu form kind', formKind('pikachu-gmax'), 'gmax'],
      ['Unown B form kind', formKind('unown-b'), 'cosmetic'],
      [
        'No form without a kind',
        scalar(db, 'SELECT count(*) FROM pokemon_forms WHERE form_kind IS NULL'),
        0,
      ],
    ];
    for (const [name, actual, expected] of phase2Facts) {
      check(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
    }

    // --- Phase 3: Item, Location, Ability and Move Dex data -----------------------------------
    const itemGroup = (identifier: string) =>
      scalar<string>(db, 'SELECT app_group FROM items WHERE identifier = ?', identifier);
    const locationKind = (identifier: string) =>
      scalar<string>(db, 'SELECT location_kind FROM locations WHERE identifier = ?', identifier);
    const phase3Facts: [string, unknown, unknown][] = [
      [
        'No item without an Item Dex group',
        scalar(db, 'SELECT count(*) FROM items WHERE app_group IS NULL'),
        0,
      ],
      ['Leftovers is a held item', itemGroup('leftovers'), 'held'],
      ['X Attack is a battle item', itemGroup('x-attack'), 'held'],
      ['Master Ball is a ball', itemGroup('master-ball'), 'ball'],
      ['Oran Berry is a berry', itemGroup('oran-berry'), 'berry'],
      ['TM01 is a machine', itemGroup('tm01'), 'machine'],
      ['Potion is medicine', itemGroup('potion'), 'medicine'],
      ['Fire Stone is an evolution item', itemGroup('fire-stone'), 'evolution'],
      ['Nugget is a treasure', itemGroup('nugget'), 'treasure'],
      ['Bicycle is a key item', itemGroup('bicycle'), 'key'],
      [
        'All but a handful of items have an icon',
        scalar(
          db,
          'SELECT count(*) < 10 FROM items i WHERE NOT EXISTS (SELECT 1 FROM item_icons c WHERE c.item_id = i.id)',
        ),
        1,
      ],
      [
        'Potion exists in Gen 9 games',
        scalar(
          db,
          'SELECT count(*) FROM item_generations WHERE item_id = 17 AND generation_id = 9',
        ),
        1,
      ],
      [
        'No location without a Location Dex group',
        scalar(db, 'SELECT count(*) FROM locations WHERE location_kind IS NULL'),
        0,
      ],
      ['Celadon City is a city', locationKind('celadon-city'), 'city'],
      ['Mesagoza is a city (curated)', locationKind('mesagoza'), 'city'],
      ['Route 1 is a route', locationKind('kanto-route-1'), 'route'],
      ['Mt. Moon is a cave', locationKind('mt-moon'), 'cave'],
      ['Lake Verity is water', locationKind('lake-verity'), 'water'],
      ['Pokémon Tower is a building', locationKind('pokemon-tower'), 'building'],
      [
        'Viridian Forest exists in Gen 1 games',
        scalar(
          db,
          'SELECT count(*) FROM location_generations WHERE location_id = 155 AND generation_id = 1',
        ),
        1,
      ],
      [
        'Static has a pt-BR effect outside battle',
        scalar(
          db,
          `SELECT count(*) FROM ability_prose_i18n
           WHERE ability_id = 9 AND lang = 'pt-BR' AND overworld_effect IS NOT NULL`,
        ),
        1,
      ],
      [
        'At least 30 curated effects outside battle',
        scalar(
          db,
          `SELECT count(DISTINCT ability_id) >= 30 FROM ability_prose_i18n
           WHERE lang = 'pt-BR' AND overworld_effect IS NOT NULL`,
        ),
        1,
      ],
      [
        'Physical is "Físico" in pt-BR',
        scalar<string>(
          db,
          `SELECT name FROM move_damage_class_i18n WHERE damage_class_id = 2 AND lang = 'pt-BR'`,
        ),
        'Físico',
      ],
      [
        'Thunderbolt Z-Move power 175',
        scalar(db, `SELECT z_power FROM moves WHERE identifier = 'thunderbolt'`),
        175,
      ],
      [
        'Z-Thunder Wave raises Sp. Def',
        scalar<string>(db, `SELECT z_boosts FROM moves WHERE identifier = 'thunder-wave'`),
        '{"special-defense":1}',
      ],
      [
        'Every type has a Z-Move with its Z-Crystal',
        scalar(
          db,
          `SELECT count(*) FROM move_variants WHERE kind = 'z' AND required_item_id IS NOT NULL`,
        ),
        18,
      ],
      [
        'Every G-Max Move has its Gigantamax Pokémon',
        scalar(db, 'SELECT count(*) FROM gmax_moves WHERE pokemon_id IS NULL'),
        0,
      ],
      ['33 G-Max Moves', scalar(db, 'SELECT count(*) FROM gmax_moves'), 33],
    ];
    for (const [name, actual, expected] of phase3Facts) {
      check(name, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
    }

    const app = openAppLikeConnection(options.dbFile);
    try {
      const orm = drizzle(app);
      const sv = await resolveGameContext(orm, 'scarlet-violet', ['en']);
      const xy = await resolveGameContext(orm, 'x-y', ['en']);
      const sm = await resolveGameContext(orm, 'sun-moon', ['en']);
      const methodsOf = async (species: number, evolved: number, ctx: typeof sv) =>
        (await getEvolutionChain(orm, species, ctx))?.nodes.find((n) => n.speciesId === evolved)
          ?.methods ?? [];
      const describe = (methods: readonly EvolutionMethod[]) =>
        methods
          .map(
            (m) =>
              `${m.trigger}:${m.minHappiness ?? ''}:${m.minAffection ?? ''}:${m.evolvedPokemon?.name ?? ''}`,
          )
          .join(',');
      const sylveonSv = await methodsOf(133, 700, sv);
      const sylveonXy = await methodsOf(133, 700, xy);
      const raichuSm = await methodsOf(25, 26, sm);
      const raichuSv = await methodsOf(25, 26, sv);
      const svList = await listPokedex(orm, sv);
      const megaMoves = await getPokemonMoves(orm, 10034, xy);
      const repoFacts: [string, boolean, string][] = [
        [
          'Sylveon evolves by friendship in Scarlet/Violet',
          sylveonSv.length === 1 && sylveonSv[0]?.minHappiness === 160,
          describe(sylveonSv),
        ],
        [
          'Sylveon evolves by affection in X/Y',
          sylveonXy.length === 1 && sylveonXy[0]?.minAffection === 2,
          describe(sylveonXy),
        ],
        [
          'Raichu has a regular and an Alolan evolution in Sun/Moon',
          raichuSm.length === 2 && raichuSm.some((m) => m.region?.identifier === 'alola'),
          describe(raichuSm),
        ],
        [
          'Raichu has no Alolan evolution in Scarlet/Violet',
          raichuSv.length === 1 && raichuSv[0]?.evolvedPokemon === null,
          describe(raichuSv),
        ],
        [
          'Scarlet/Violet list starts at Paldea #1 Sprigatito',
          svList[0]?.identifier === 'sprigatito' && svList[0].regionalNumber === 1,
          `${svList[0]?.identifier} #${svList[0]?.regionalNumber}`,
        ],
        [
          'Mega Charizard X has a moveset in X/Y',
          megaMoves.moves.length > 0,
          `${megaMoves.moves.length} moves`,
        ],
      ];
      for (const [name, ok, detail] of repoFacts) check(name, ok, detail);

      const rb = await resolveGameContext(orm, 'red-blue', ['en']);
      const swsh = await resolveGameContext(orm, 'sword-shield', ['en']);
      const svMoves = await listMoves(orm, sv);
      const swshMax = (await listMoves(orm, swsh)).filter((m) => m.variantKind === 'max');
      const thunderbolt = await getMoveDetail(orm, 85, sv);
      const learners = await getMoveLearners(orm, 85, sv);
      const intimidate = await getAbilityHolders(orm, 22, sv);
      const mtMoon = await getLocationEncounters(
        orm,
        scalar<number>(db, `SELECT id FROM locations WHERE identifier = 'mt-moon'`),
        rb,
      );
      const natures = await listNatures(orm, sv);
      const phase3Repos: [string, boolean, string][] = [
        ['Scarlet/Violet Move Dex has 800+ moves', svMoves.length >= 800, `${svMoves.length}`],
        [
          'No Z-Move or Max Move in the Scarlet/Violet Move Dex',
          svMoves.every((m) => m.variantKind === null),
          svMoves
            .filter((m) => m.variantKind)
            .map((m) => m.identifier)
            .join(', '),
        ],
        [
          'The Sword/Shield Move Dex lists the 19 Max Moves',
          swshMax.length === 19,
          `${swshMax.length}`,
        ],
        [
          'Thunderbolt: a TM in Scarlet/Violet, Gigavolt Havoc and Max Lightning',
          thunderbolt?.machine?.label.startsWith('TM') === true &&
            thunderbolt.maxMove?.move?.identifier === 'max-lightning' &&
            thunderbolt.zMove?.move?.identifier === 'gigavolt-havoc--special',
          JSON.stringify({
            machine: thunderbolt?.machine,
            max: thunderbolt?.maxMove?.move,
            z: thunderbolt?.zMove?.move,
          }),
        ],
        [
          'Pikachu learns Thunderbolt in Scarlet/Violet (move learners)',
          learners.some((l) => l.pokemonId === 25),
          `${learners.length} learners`,
        ],
        [
          'Gyarados has Intimidate in Scarlet/Violet (ability holders)',
          intimidate.some((h) => h.pokemonId === 130 && !h.isHidden),
          `${intimidate.length} holders`,
        ],
        [
          'Zubat lives in Mt. Moon in Red/Blue (location encounters)',
          mtMoon.some((area) => area.encounters.some((e) => e.pokemon.id === 41)),
          `${mtMoon.length} areas`,
        ],
        [
          '25 natures, 5 of them neutral',
          natures.length === 25 && natures.filter((n) => n.increased === null).length === 5,
          `${natures.length}`,
        ],
      ];
      for (const [name, ok, detail] of phase3Repos) check(name, ok, detail);
    } finally {
      app.close();
    }

    // --- Query plans ---------------------------------------------------------------------
    const plans = await checkHotQueryPlans(db, { game: 'scarlet-violet', pokemonId: 25 });
    check(
      `${plans.checked} hot queries avoid full scans of large tables`,
      plans.checked >= 40 && plans.violations.length === 0,
      plans.violations.map((v) => `[${v.label}] ${v.detail}`).join('; ') ||
        `${plans.checked} captured`,
    );

    // --- Engine cross-checks ----------------------------------------------------------------
    if (options.csvDir && existsSync(path.join(options.csvDir, 'type_efficacy.csv'))) {
      const typeIds = new Map(
        readCsv(options.csvDir, 'types').map((row) => [row.id ?? '', row.identifier ?? '']),
      );
      const mismatches: string[] = [];
      const compare = (atkId: string, defId: string, factor: string, gen: Generation) => {
        const atk = typeIds.get(atkId) ?? '';
        const def = typeIds.get(defId) ?? '';
        if (!isTypeName(atk) || !isTypeName(def)) return;
        const expected = Number(factor) / 100;
        const actual = chartMultiplier(atk, def, gen);
        if (actual !== expected)
          mismatches.push(`${atk}->${def} gen${gen}: ${expected} vs engine ${actual}`);
      };
      for (const row of readCsv(options.csvDir, 'type_efficacy')) {
        compare(row.damage_type_id ?? '', row.target_type_id ?? '', row.damage_factor ?? '', 9);
      }
      for (const row of readCsv(options.csvDir, 'type_efficacy_past')) {
        compare(
          row.damage_type_id ?? '',
          row.target_type_id ?? '',
          row.damage_factor ?? '',
          Number(row.generation_id) as Generation,
        );
      }
      check(
        'PokeAPI type chart matches the engine',
        mismatches.length === 0,
        mismatches.join('; '),
      );

      const classMismatches = readCsv(options.csvDir, 'types')
        .filter(
          (row) =>
            isTypeName(row.identifier ?? '') && row.identifier !== 'fairy' && row.damage_class_id,
        )
        .filter((row) => {
          const expected = row.damage_class_id === '2' ? 'physical' : 'special';
          return (
            legacyDamageClass(row.identifier as Parameters<typeof legacyDamageClass>[0]) !==
            expected
          );
        })
        .map((row) => row.identifier);
      check(
        'PokeAPI legacy damage classes match the engine',
        classMismatches.length === 0,
        classMismatches.join(', '),
      );

      const statNames = new Map(
        readCsv(options.csvDir, 'stats').map((row) => [row.id ?? '', row.identifier ?? '']),
      );
      const natureMismatches = readCsv(options.csvDir, 'natures')
        .filter((row) => {
          const name = row.identifier ?? '';
          if (!isNatureName(name)) return true;
          const nature = NATURES[name];
          const increased = statNames.get(row.increased_stat_id ?? '');
          const decreased = statNames.get(row.decreased_stat_id ?? '');
          return nature.increased === null
            ? increased !== decreased
            : nature.increased !== increased || nature.decreased !== decreased;
        })
        .map((row) => row.identifier);
      check(
        'PokeAPI natures match the engine',
        natureMismatches.length === 0,
        natureMismatches.join(', '),
      );
    } else {
      warnings.push('PokeAPI CSVs not found — engine cross-checks skipped');
    }

    // --- Size budget ------------------------------------------------------------------------
    const size = statSync(options.dbFile).size;
    const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    check(`size ≤ ${mb(options.sizeFailBytes)}`, size <= options.sizeFailBytes, mb(size));
    if (size > options.sizeWarnBytes) {
      warnings.push(`size ${mb(size)} is above the ${mb(options.sizeWarnBytes)} warning budget`);
    }

    const unmappedMainAbilities = scalar(
      db,
      'SELECT count(*) FROM abilities WHERE ps_id IS NULL AND is_main_series = 1',
    );
    if (unmappedMainAbilities > 0)
      warnings.push(`${unmappedMainAbilities} main-series abilities without Showdown ID`);
    const unmappedPokemon = scalar(db, 'SELECT count(*) FROM pokemon WHERE ps_id IS NULL');
    if (unmappedPokemon > 0)
      warnings.push(`${unmappedPokemon} pokemon varieties without Showdown ID`);
  } finally {
    db.close();
  }
  return { errors, warnings, passed };
}
