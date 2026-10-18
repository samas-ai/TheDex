import { sql } from 'drizzle-orm';
import { stripProseMarkup } from '../prose';
import { langRank, pickI18n, sqlList } from '../sql';
import type { AnySQLiteDatabase, GameContext } from '../types';
import type { NamedEntity } from './catalog';
import { getPokemon, type PokemonDetail } from './pokemon';

export interface EvYield {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly specialAttack: number;
  readonly specialDefense: number;
  readonly speed: number;
}

/** RF02.1–RF02.2: everything the profile header and "About" tab need. */
export interface PokemonProfile extends PokemonDetail {
  /** Name of the variety's default form when it has one ("Teal Mask", "Meadow Pattern"). */
  readonly formName: string | null;
  readonly nationalNumber: number;
  /** Number in the context game's regional dex (null when absent). */
  readonly regionalNumber: number | null;
  /** Whether the variety exists in the context game (game_pokemon). */
  readonly inGame: boolean;
  readonly baseExperience: number | null;
  readonly evYield: EvYield | null;
  readonly species: {
    readonly generationId: number;
    /** Chance of being female in eighths; -1 = genderless. */
    readonly genderRate: number;
    readonly captureRate: number;
    readonly baseHappiness: number | null;
    /** Egg cycles. */
    readonly hatchCounter: number | null;
    readonly isBaby: boolean;
    readonly isLegendary: boolean;
    readonly isMythical: boolean;
    readonly hasGenderDifferences: boolean;
    readonly evolutionChainId: number | null;
    readonly growthRate: NamedEntity;
    readonly eggGroups: readonly NamedEntity[];
    /** species_tags (starter, legendary, paradox…). */
    readonly tags: readonly string[];
  };
}

export async function getPokemonProfile(
  db: AnySQLiteDatabase,
  pokemonId: number,
  ctx: GameContext,
): Promise<PokemonProfile | null> {
  const detail = await getPokemon(db, pokemonId, ctx);
  if (!detail) return null;
  const { langChain } = ctx;

  const row = (await db.get(sql`
    SELECT p.base_experience, ps.generation_id, ps.gender_rate, ps.capture_rate,
      ps.base_happiness, ps.hatch_counter, ps.is_baby, ps.is_legendary, ps.is_mythical,
      ps.has_gender_differences, ps.evolution_chain_id,
      g.id AS growth_rate_id, g.identifier AS growth_rate_identifier,
      ${pickI18n('growth_rate_i18n', 'growth_rate_id', sql`g.id`, 'name', langChain)} AS growth_rate_name,
      gp.regional_number, gp.pokemon_id IS NOT NULL AS in_game,
      (SELECT ${pickI18n('form_i18n', 'form_id', sql`f.id`, 'form_name', langChain)}
         FROM pokemon_forms f WHERE f.pokemon_id = p.id AND f.is_default = 1 LIMIT 1) AS form_name,
      s.ev_hp, s.ev_attack, s.ev_defense, s.ev_special_attack, s.ev_special_defense, s.ev_speed
    FROM pokemon p
    JOIN pokemon_species ps ON ps.id = p.species_id
    JOIN growth_rates g ON g.id = ps.growth_rate_id
    LEFT JOIN game_pokemon gp ON gp.game_id = ${ctx.gameId} AND gp.pokemon_id = p.id
    LEFT JOIN pokemon_stats_by_gen s ON s.pokemon_id = p.id AND s.generation_id = ${ctx.generationId}
    WHERE p.id = ${pokemonId}`)) as {
    base_experience: number | null;
    generation_id: number;
    gender_rate: number;
    capture_rate: number;
    base_happiness: number | null;
    hatch_counter: number | null;
    is_baby: number;
    is_legendary: number;
    is_mythical: number;
    has_gender_differences: number;
    evolution_chain_id: number | null;
    growth_rate_id: number;
    growth_rate_identifier: string;
    growth_rate_name: string | null;
    regional_number: number | null;
    in_game: number;
    form_name: string | null;
    ev_hp: number | null;
    ev_attack: number;
    ev_defense: number;
    ev_special_attack: number;
    ev_special_defense: number;
    ev_speed: number;
  };

  const eggGroups = (await db.all(sql`
    SELECT e.id, e.identifier, ${pickI18n('egg_group_i18n', 'egg_group_id', sql`e.id`, 'name', langChain)} AS name
    FROM pokemon_egg_groups pe JOIN egg_groups e ON e.id = pe.egg_group_id
    WHERE pe.species_id = ${detail.speciesId} ORDER BY e.id`)) as {
    id: number;
    identifier: string;
    name: string | null;
  }[];
  const tags = (await db.all(
    sql`SELECT tag FROM species_tags WHERE species_id = ${detail.speciesId} ORDER BY tag`,
  )) as { tag: string }[];

  return {
    ...detail,
    formName: row.form_name,
    nationalNumber: detail.speciesId,
    regionalNumber: row.regional_number,
    inGame: row.in_game === 1,
    baseExperience: row.base_experience,
    evYield:
      row.ev_hp === null
        ? null
        : {
            hp: row.ev_hp,
            attack: row.ev_attack,
            defense: row.ev_defense,
            specialAttack: row.ev_special_attack,
            specialDefense: row.ev_special_defense,
            speed: row.ev_speed,
          },
    species: {
      generationId: row.generation_id,
      genderRate: row.gender_rate,
      captureRate: row.capture_rate,
      baseHappiness: row.base_happiness,
      hatchCounter: row.hatch_counter,
      isBaby: row.is_baby === 1,
      isLegendary: row.is_legendary === 1,
      isMythical: row.is_mythical === 1,
      hasGenderDifferences: row.has_gender_differences === 1,
      evolutionChainId: row.evolution_chain_id,
      growthRate: {
        id: row.growth_rate_id,
        identifier: row.growth_rate_identifier,
        name: row.growth_rate_name ?? row.growth_rate_identifier,
      },
      eggGroups: eggGroups.map((group) => ({
        id: group.id,
        identifier: group.identifier,
        name: group.name ?? group.identifier,
      })),
      tags: tags.map((tag) => tag.tag),
    },
  };
}

export interface FlavorTextEntry {
  readonly versionId: number;
  readonly versionIdentifier: string;
  readonly versionName: string;
  readonly text: string;
  readonly lang: string;
  /** Whether the version belongs to the context game. */
  readonly inGame: boolean;
}

/**
 * Pokédex entries (RF02.2), one per version in the best language of the chain, in release
 * order. Entries of other games are included (flagged) for games PokeAPI has no text for.
 */
export async function getFlavorTexts(
  db: AnySQLiteDatabase,
  speciesId: number,
  ctx: GameContext,
): Promise<FlavorTextEntry[]> {
  const { langChain } = ctx;
  const inGame =
    ctx.versionIds.length > 0 ? sql`sft.version_id IN (${sqlList(ctx.versionIds)})` : sql`0`;
  const rows = (await db.all(sql`
    SELECT version_id, version_identifier, version_name, text, lang, in_game FROM (
      SELECT sft.version_id, v.identifier AS version_identifier, sft.lang, ft.text,
        ${pickI18n('version_i18n', 'version_id', sql`v.id`, 'name', langChain)} AS version_name,
        ${inGame} AS in_game, vg.sort_order,
        ROW_NUMBER() OVER (PARTITION BY sft.version_id ORDER BY ${langRank(sql`sft.lang`, langChain)}) AS rn
      FROM species_flavor_text sft
      JOIN flavor_texts ft ON ft.id = sft.flavor_text_id
      JOIN versions v ON v.id = sft.version_id
      JOIN version_groups vg ON vg.id = v.version_group_id
      WHERE sft.species_id = ${speciesId} AND sft.lang IN (${sqlList(langChain)})
    ) WHERE rn = 1
    ORDER BY sort_order, version_id`)) as {
    version_id: number;
    version_identifier: string;
    version_name: string | null;
    text: string;
    lang: string;
    in_game: number;
  }[];
  return rows.map((row) => ({
    versionId: row.version_id,
    versionIdentifier: row.version_identifier,
    versionName: row.version_name ?? row.version_identifier,
    text: row.text,
    lang: row.lang,
    inGame: row.in_game === 1,
  }));
}

export interface AbilityDetail extends NamedEntity {
  readonly generationId: number;
  readonly shortEffect: string | null;
  readonly effect: string | null;
  /** In-game description from the context game, else the latest earlier one. */
  readonly flavorText: string | null;
}

/** Ability sheet content (RF02.2): battle effect prose + in-game description. */
export async function getAbilityDetail(
  db: AnySQLiteDatabase,
  abilityId: number,
  ctx: GameContext,
): Promise<AbilityDetail | null> {
  const { langChain } = ctx;
  const row = (await db.get(sql`
    SELECT a.id, a.identifier, a.generation_id,
      ${pickI18n('ability_i18n', 'ability_id', sql`a.id`, 'name', langChain)} AS name,
      ${pickI18n('ability_prose_i18n', 'ability_id', sql`a.id`, 'short_effect', langChain)} AS short_effect,
      ${pickI18n('ability_prose_i18n', 'ability_id', sql`a.id`, 'effect', langChain)} AS effect
    FROM abilities a WHERE a.id = ${abilityId}`)) as
    | {
        id: number;
        identifier: string;
        generation_id: number;
        name: string | null;
        short_effect: string | null;
        effect: string | null;
      }
    | undefined;
  if (!row) return null;

  const flavor = (await db.get(sql`
    SELECT ft.text FROM ability_flavor_text aft
    JOIN flavor_texts ft ON ft.id = aft.flavor_text_id
    JOIN version_groups vg ON vg.id = aft.version_group_id
    WHERE aft.ability_id = ${abilityId} AND aft.lang IN (${sqlList(langChain)})
      AND vg.sort_order <= (SELECT max(sort_order) FROM version_groups
                            WHERE id IN (${sqlList(ctx.versionGroupIds)}))
    ORDER BY ${langRank(sql`aft.lang`, langChain)}, vg.sort_order DESC LIMIT 1`)) as
    { text: string } | undefined;

  return {
    id: row.id,
    identifier: row.identifier,
    name: row.name ?? row.identifier,
    generationId: row.generation_id,
    shortEffect: row.short_effect === null ? null : stripProseMarkup(row.short_effect),
    effect: row.effect === null ? null : stripProseMarkup(row.effect),
    flavorText: flavor?.text ?? null,
  };
}
