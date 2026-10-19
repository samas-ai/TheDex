import {
  fillStats,
  isTypeName,
  legacyDamageClass,
  SHOWDOWN_STATS,
  toShowdownId,
  TYPE_NAMES,
  type CoverageMember,
  type Generation,
  type ShowdownSet,
  type TypeName,
} from '@thedex/engine';
import {
  MOVE_SLOTS,
  natureFromShowdown,
  teamMemberSchema,
  type MoveSummary,
  type PokemonAbility,
  type ShowdownIdMaps,
  type ShowdownNameMaps,
  type TeamMember,
} from '@thedex/db';
import { capitalize } from '../../shared/format';

// --- Slot options ----------------------------------------------------------------------------

/**
 * Genders a species can have (PokeAPI gender rate: eighths female, -1 genderless). '' leaves it
 * to the game. Gender does not exist in Gen 1.
 */
export function genderOptions(genderRate: number, gen: Generation): ('' | 'M' | 'F')[] {
  if (gen === 1 || genderRate < 0) return [''];
  if (genderRate === 0) return ['M'];
  if (genderRate === 8) return ['F'];
  return ['', 'M', 'F'];
}

/** A new slot's defaults: its first regular ability (Gen 3+) and the only possible gender. */
export function slotDefaults(
  abilities: readonly PokemonAbility[],
  genderRate: number,
  gen: Generation,
): Pick<TeamMember, 'abilityId' | 'gender'> {
  const ability = gen >= 3 ? (abilities.find((a) => !a.isHidden) ?? abilities[0]) : undefined;
  const genders = genderOptions(genderRate, gen);
  return { abilityId: ability?.id ?? null, gender: genders.length === 1 ? genders[0]! : '' };
}

/** Fills an imported slot's missing ability and gender (Showdown text may leave them out). */
export function withSlotDefaults(
  member: TeamMember,
  defaults: Pick<TeamMember, 'abilityId' | 'gender'>,
): TeamMember {
  return {
    ...member,
    abilityId: member.abilityId ?? defaults.abilityId,
    gender: member.gender || defaults.gender,
  };
}

/** Move ids by slot, always `MOVE_SLOTS` long. */
export function moveSlots(member: Pick<TeamMember, 'moveIds'>): (number | null)[] {
  return Array.from({ length: MOVE_SLOTS }, (_, index) => member.moveIds[index] ?? null);
}

/** Puts `moveId` in a slot (null clears it); a move already in another slot moves there. */
export function setMove(
  member: Pick<TeamMember, 'moveIds'>,
  slot: number,
  moveId: number | null,
): (number | null)[] {
  const slots = moveSlots(member).map((id) => (id === moveId ? null : id));
  slots[slot] = moveId;
  return slots;
}

/** Chosen moves the Pokémon cannot learn in the game (optional legality check, RF08.2). */
export function illegalMoves(
  member: Pick<TeamMember, 'moveIds'>,
  learnable: ReadonlySet<number>,
): number[] {
  return member.moveIds.filter((id): id is number => id !== null && !learnable.has(id));
}

// --- Hidden Power --------------------------------------------------------------------------

export const HIDDEN_POWER = 'hidden-power';

/** Types Hidden Power can take (never Normal or Fairy), Gen 2–7. */
export const HIDDEN_POWER_TYPES: readonly TypeName[] = TYPE_NAMES.filter(
  (type) => type !== 'normal' && type !== 'fairy',
);

/** Type a move hits with: Hidden Power takes the slot's chosen type. */
export function moveTypeFor(
  move: Pick<MoveSummary, 'identifier' | 'type'>,
  member: Pick<TeamMember, 'hpType'>,
): string | null {
  return move.identifier === HIDDEN_POWER && member.hpType ? member.hpType : move.type;
}

/** Move category in the team's generation (Gen 1–3 Hidden Power follows its chosen type). */
export function moveClassFor(
  move: Pick<MoveSummary, 'identifier' | 'type' | 'damageClass'>,
  member: Pick<TeamMember, 'hpType'>,
  gen: Generation,
): string | null {
  const type = moveTypeFor(move, member);
  if (move.identifier === HIDDEN_POWER && gen <= 3 && type && isTypeName(type)) {
    return legacyDamageClass(type);
  }
  return move.damageClass;
}

// --- Coverage (RF08.3) -----------------------------------------------------------------------

/** What the coverage analysis needs of each member's variety. */
export interface MemberInfo {
  readonly types: readonly string[];
  readonly abilities: readonly PokemonAbility[];
}

/**
 * Coverage input for the engine: typings (unknown types dropped), the chosen ability (type
 * immunities) and the types of damaging moves. Members without a typing in the generation are
 * skipped.
 */
export function coverageMembers(
  members: readonly TeamMember[],
  info: ReadonlyMap<number, MemberInfo>,
  moves: ReadonlyMap<number, MoveSummary>,
): { member: TeamMember; coverage: CoverageMember }[] {
  const result: { member: TeamMember; coverage: CoverageMember }[] = [];
  for (const member of members) {
    const variety = info.get(member.pokemonId);
    const types = (variety?.types ?? []).filter(isTypeName);
    if (types.length === 0) continue;
    const ability = variety?.abilities.find((a) => a.id === member.abilityId)?.identifier ?? null;
    const moveTypes: TypeName[] = [];
    for (const id of member.moveIds) {
      const move = id === null ? undefined : moves.get(id);
      const type = move ? moveTypeFor(move, member) : null;
      if (type && move?.damageClass !== 'status' && isTypeName(type)) moveTypes.push(type);
    }
    result.push({ member, coverage: { types, ability, moveTypes } });
  }
  return result;
}

// --- Showdown (RF08.4) -----------------------------------------------------------------------

/** Showdown's spelling of a type identifier (`fire` → `Fire`). */
export function showdownType(identifier: string): string {
  return capitalize(identifier);
}

/** A slot as a Showdown set, with names from `getShowdownNames`. */
export function toShowdownSet(
  member: TeamMember,
  names: ShowdownNameMaps,
  gen: Generation,
): ShowdownSet {
  const name = (map: ReadonlyMap<number, string>, id: number | null) =>
    id === null ? '' : (map.get(id) ?? '');
  return {
    name: member.nickname,
    species: name(names.pokemon, member.pokemonId),
    item: gen >= 2 ? name(names.items, member.itemId) : '',
    ability: gen >= 3 ? name(names.abilities, member.abilityId) : '',
    moves: member.moveIds
      .filter((id): id is number => id !== null)
      .map((id) => name(names.moves, id))
      .filter((move) => move !== ''),
    nature: gen >= 3 && member.nature ? capitalize(member.nature) : '',
    gender: gen >= 2 ? member.gender : '',
    evs: member.evs,
    ivs: member.ivs,
    level: member.level,
    shiny: gen >= 2 && member.shiny,
    happiness: member.happiness,
    hpType: member.hpType && gen >= 2 && gen <= 7 ? showdownType(member.hpType) : undefined,
    dynamaxLevel: gen === 8 ? member.dynamaxLevel : undefined,
    gigantamax: gen === 8 && member.gigantamax,
    teraType: gen === 9 && member.teraType ? showdownType(member.teraType) : undefined,
  };
}

/** Names `toShowdownSet` needs for a team. */
export function showdownIdsOf(members: readonly TeamMember[]) {
  return {
    pokemon: members.map((m) => m.pokemonId),
    items: members.flatMap((m) => (m.itemId === null ? [] : [m.itemId])),
    abilities: members.flatMap((m) => (m.abilityId === null ? [] : [m.abilityId])),
    moves: members.flatMap((m) => m.moveIds.filter((id): id is number => id !== null)),
  };
}

/** Names `fromShowdownSet` needs resolved (`resolveShowdownNames`). */
export function showdownNamesOf(sets: readonly ShowdownSet[]) {
  return {
    species: sets.map((set) => set.species),
    items: sets.map((set) => set.item).filter((item) => item !== ''),
    abilities: sets.map((set) => set.ability).filter((ability) => ability !== ''),
    moves: sets.flatMap((set) => set.moves),
  };
}

function typeOrNull(name: string | undefined): TypeName | null {
  const id = name ? toShowdownId(name) : '';
  return isTypeName(id) ? id : null;
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.round(value)));

export interface ImportedMember {
  /** Null when the species is unknown. */
  readonly member: TeamMember | null;
  /** Names that did not match anything (species, item, ability, moves). */
  readonly unresolved: readonly string[];
}

/**
 * A Showdown set as a slot. Missing EVs are 0 (252 in Gen 1–2, as Showdown does), values are
 * clamped to the slot ranges, and unknown names are reported instead of failing the import.
 */
export function fromShowdownSet(
  set: ShowdownSet,
  ids: ShowdownIdMaps,
  gen: Generation,
): ImportedMember {
  const unresolved: string[] = [];
  const lookup = (map: ReadonlyMap<string, number>, name: string): number | null => {
    if (name === '') return null;
    const id = map.get(toShowdownId(name));
    if (id === undefined) unresolved.push(name);
    return id ?? null;
  };
  const pokemonId = lookup(ids.pokemon, set.species);
  const itemId = lookup(ids.items, set.item);
  const abilityId = lookup(ids.abilities, set.ability);
  const moveIds = set.moves
    .map((move) => lookup(ids.moves, move))
    .filter((id): id is number => id !== null)
    .slice(0, MOVE_SLOTS);
  if (pokemonId === null) return { member: null, unresolved };

  const evs = fillStats(set.evs, gen <= 2 ? 252 : 0);
  const ivs = fillStats(set.ivs, 31);
  const tera = set.teraType ? toShowdownId(set.teraType) : '';
  const parsed = teamMemberSchema.safeParse({
    pokemonId,
    nickname: set.name === set.species ? '' : set.name.slice(0, 40),
    level: clamp(set.level ?? 100, 1, 100),
    gender: set.gender,
    shiny: set.shiny ?? false,
    abilityId,
    nature: natureFromShowdown(set.nature),
    itemId,
    teraType: tera === 'stellar' ? 'stellar' : typeOrNull(set.teraType),
    moveIds,
    evs: Object.fromEntries(SHOWDOWN_STATS.map((stat) => [stat, clamp(evs[stat], 0, 255)])),
    ivs: Object.fromEntries(SHOWDOWN_STATS.map((stat) => [stat, clamp(ivs[stat], 0, 31)])),
    happiness: clamp(set.happiness ?? 255, 0, 255),
    hpType: typeOrNull(set.hpType),
    gigantamax: set.gigantamax ?? false,
    dynamaxLevel: clamp(set.dynamaxLevel ?? 10, 0, 10),
  });
  return { member: parsed.success ? parsed.data : null, unresolved };
}

/**
 * Game for an imported team: the fallback when it matches the format's generation (`gen4ou`),
 * else the first game of that generation (Japan-only releases skipped).
 */
export function gameForFormat(
  format: string | null,
  games: readonly {
    readonly id: number;
    readonly identifier: string;
    readonly generationId: number;
  }[],
  fallbackId: number,
): number {
  const gen = format ? /^gen(\d)/i.exec(format.trim())?.[1] : undefined;
  if (!gen) return fallbackId;
  const generationId = Number(gen);
  if (games.find((game) => game.id === fallbackId)?.generationId === generationId)
    return fallbackId;
  const match = games.find(
    (game) => game.generationId === generationId && !game.identifier.endsWith('-japan'),
  );
  return match?.id ?? fallbackId;
}
