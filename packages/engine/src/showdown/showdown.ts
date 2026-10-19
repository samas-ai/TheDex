/**
 * Pokémon Showdown team text (RF08.4): the "export" format of the Showdown teambuilder.
 * Names stay as text — mapping them to PokeAPI ids is the caller's job (see `toShowdownId`).
 */

/** Showdown stat keys, in display order. */
export const SHOWDOWN_STATS = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'] as const;
export type ShowdownStat = (typeof SHOWDOWN_STATS)[number];
export type StatsTable = Record<ShowdownStat, number>;

export interface ShowdownSet {
  /** Nickname, or '' when the Pokémon has none. */
  readonly name: string;
  readonly species: string;
  readonly item: string;
  readonly ability: string;
  readonly moves: readonly string[];
  /** Nature name ("Adamant"), or '' when absent (Gen 1–2). */
  readonly nature: string;
  readonly gender: '' | 'M' | 'F';
  /** Only the stats written in the text (missing = the format's default: 0, or 252 in Gen 1–2). */
  readonly evs: Partial<StatsTable>;
  /** Only the stats written in the text (missing = 31). */
  readonly ivs: Partial<StatsTable>;
  readonly level?: number;
  readonly shiny?: boolean;
  readonly happiness?: number;
  readonly pokeball?: string;
  /** Hidden Power type, from `Hidden Power: Fire` or a `- Hidden Power [Fire]` move. */
  readonly hpType?: string;
  readonly dynamaxLevel?: number;
  readonly gigantamax?: boolean;
  readonly teraType?: string;
}

export interface ShowdownTeam {
  /** From a `=== [format] Folder/Name ===` header; null for a bare list of sets. */
  readonly name: string | null;
  readonly format: string | null;
  readonly folder: string | null;
  readonly sets: readonly ShowdownSet[];
}

/** Showdown's `toID`: lower case, letters and digits only ("Mr. Mime" → `mrmime`). */
export function toShowdownId(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

const STAT_LABELS: Readonly<Record<ShowdownStat, string>> = {
  hp: 'HP',
  atk: 'Atk',
  def: 'Def',
  spa: 'SpA',
  spd: 'SpD',
  spe: 'Spe',
};

/** Stat spellings accepted by Showdown's importer (`Dex.stats.getID`). */
const STAT_ALIASES: Readonly<Record<string, ShowdownStat>> = {
  hp: 'hp',
  hitpoints: 'hp',
  atk: 'atk',
  attack: 'atk',
  def: 'def',
  defense: 'def',
  spa: 'spa',
  spatk: 'spa',
  satk: 'spa',
  specialattack: 'spa',
  spc: 'spa',
  special: 'spa',
  spd: 'spd',
  spdef: 'spd',
  sdef: 'spd',
  specialdefense: 'spd',
  spe: 'spe',
  speed: 'spe',
};

/** A full stats table with `value` wherever `partial` has nothing. */
export function fillStats(partial: Partial<StatsTable>, value: number): StatsTable {
  return {
    hp: partial.hp ?? value,
    atk: partial.atk ?? value,
    def: partial.def ?? value,
    spa: partial.spa ?? value,
    spd: partial.spd ?? value,
    spe: partial.spe ?? value,
  };
}

/** `252 Atk / 4 SpD` → `{ atk: 252, spd: 4 }`; unknown stats and non-numbers are ignored. */
function parseSpread(text: string): Partial<StatsTable> {
  const spread: Partial<StatsTable> = {};
  for (const part of text.split('/')) {
    const match = /^\s*(\d+)\s+(.+?)\s*$/.exec(part);
    if (!match) continue;
    const stat = STAT_ALIASES[toShowdownId(match[2]!)];
    if (stat) spread[stat] = Number(match[1]);
  }
  return spread;
}

interface MutableSet {
  name: string;
  species: string;
  item: string;
  ability: string;
  moves: string[];
  nature: string;
  gender: '' | 'M' | 'F';
  evs: Partial<StatsTable>;
  ivs: Partial<StatsTable>;
  level?: number;
  shiny?: boolean;
  happiness?: number;
  pokeball?: string;
  hpType?: string;
  dynamaxLevel?: number;
  gigantamax?: boolean;
  teraType?: string;
}

/** First line: `Nickname (Species) (F) @ Item`, `Species (M)`, `Species @ Item`… */
function parseHeadLine(line: string): MutableSet {
  let rest = line;
  let item = '';
  const at = rest.lastIndexOf(' @ ');
  if (at !== -1) {
    item = rest.slice(at + 3).trim();
    rest = rest.slice(0, at);
  }
  let gender: '' | 'M' | 'F' = '';
  const genderMatch = /\s\((M|F)\)$/.exec(rest);
  if (genderMatch) {
    gender = genderMatch[1] as 'M' | 'F';
    rest = rest.slice(0, genderMatch.index);
  }
  let name = '';
  let species = rest.trim();
  const paren = rest.lastIndexOf(' (');
  if (rest.endsWith(')') && paren !== -1) {
    species = rest.slice(paren + 2, -1).trim();
    name = rest.slice(0, paren).trim();
  }
  return {
    name,
    species,
    item,
    ability: '',
    moves: [],
    nature: '',
    gender,
    evs: {},
    ivs: {},
  };
}

const YES = /^yes$/i;

/** Applies one attribute line to the set; unknown lines are ignored (like Showdown). */
function parseLine(set: MutableSet, line: string): void {
  if (line.startsWith('-') || line.startsWith('~')) {
    let move = line.slice(1).trim();
    const hiddenPower = /^Hidden Power\s*\[\s*(.+?)\s*\]$/i.exec(move);
    if (hiddenPower) {
      set.hpType = hiddenPower[1]!;
      move = 'Hidden Power';
    }
    if (move !== '') set.moves.push(move);
    return;
  }
  const nature = /^(\w+)\s+Nature$/i.exec(line);
  if (nature) {
    set.nature = nature[1]!;
    return;
  }
  const colon = line.indexOf(':');
  if (colon === -1) return;
  const key = line.slice(0, colon).trim().toLowerCase();
  const value = line.slice(colon + 1).trim();
  const integer = /^\d+$/.test(value) ? Number(value) : null;
  switch (key) {
    case 'ability':
    case 'trait':
      set.ability = value;
      break;
    case 'level':
      if (integer !== null) set.level = integer;
      break;
    case 'shiny':
      set.shiny = YES.test(value);
      break;
    case 'happiness':
    case 'friendship':
      if (integer !== null) set.happiness = integer;
      break;
    case 'pokeball':
    case 'ball':
      set.pokeball = value;
      break;
    case 'hidden power':
      set.hpType = value;
      break;
    case 'dynamax level':
      if (integer !== null) set.dynamaxLevel = integer;
      break;
    case 'gigantamax':
      set.gigantamax = YES.test(value);
      break;
    case 'tera type':
      set.teraType = value;
      break;
    case 'evs':
      set.evs = parseSpread(value);
      break;
    case 'ivs':
      set.ivs = parseSpread(value);
      break;
  }
}

const TEAM_HEADER = /^===\s*(?:\[([^\]]*)\]\s*)?(.*?)\s*===$/;

/**
 * Parses Showdown team text: one or more sets separated by blank lines, optionally grouped in
 * teams by `=== [gen9ou] Folder/Name ===` headers (the teambuilder's "backup" export).
 * Teams without sets are dropped.
 */
export function parseShowdownTeams(text: string): ShowdownTeam[] {
  const teams: (Omit<ShowdownTeam, 'sets'> & { sets: MutableSet[] })[] = [];
  let set: MutableSet | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const header = TEAM_HEADER.exec(line);
    if (header) {
      const title = header[2]!;
      const slash = title.lastIndexOf('/');
      teams.push({
        format: header[1]?.trim() || null,
        folder: slash === -1 ? null : title.slice(0, slash).trim() || null,
        name: (slash === -1 ? title : title.slice(slash + 1)).trim() || null,
        sets: [],
      });
      set = null;
      continue;
    }
    if (line === '') {
      set = null;
      continue;
    }
    if (set === null) {
      if (teams.length === 0) teams.push({ name: null, format: null, folder: null, sets: [] });
      set = parseHeadLine(line);
      teams[teams.length - 1]!.sets.push(set);
      continue;
    }
    parseLine(set, line);
  }

  return teams
    .map((team) => ({ ...team, sets: team.sets.filter((s) => s.species !== '') }))
    .filter((team) => team.sets.length > 0);
}

/** Every set in the text, ignoring team headers (pasting one team or a single set). */
export function parseShowdownSets(text: string): ShowdownSet[] {
  return parseShowdownTeams(text).flatMap((team) => team.sets);
}

function formatSpread(spread: Partial<StatsTable>, skip: number): string | null {
  const parts = SHOWDOWN_STATS.filter(
    (stat) => spread[stat] !== undefined && spread[stat] !== skip,
  ).map((stat) => `${spread[stat]} ${STAT_LABELS[stat]}`);
  return parts.length > 0 ? parts.join(' / ') : null;
}

export interface ExportOptions {
  /**
   * EV value left out of the `EVs:` line: 0, or 252 for Gen 1–2, where Showdown fills missing
   * EVs with 252 (so a 0 must be written).
   */
  readonly defaultEv?: number;
}

/** One set in Showdown's export format (defaults are omitted, as Showdown does). */
export function exportShowdownSet(set: ShowdownSet, options: ExportOptions = {}): string {
  let head = set.name && set.name !== set.species ? `${set.name} (${set.species})` : set.species;
  if (set.gender) head += ` (${set.gender})`;
  if (set.item) head += ` @ ${set.item}`;
  const lines = [head];
  if (set.ability) lines.push(`Ability: ${set.ability}`);
  if (set.level !== undefined && set.level !== 100) lines.push(`Level: ${set.level}`);
  if (set.shiny) lines.push('Shiny: Yes');
  if (set.happiness !== undefined && set.happiness !== 255) {
    lines.push(`Happiness: ${set.happiness}`);
  }
  if (set.pokeball) lines.push(`Pokeball: ${set.pokeball}`);
  const hiddenPowerMove = set.moves.some((move) => toShowdownId(move) === 'hiddenpower');
  if (set.hpType && !hiddenPowerMove) lines.push(`Hidden Power: ${set.hpType}`);
  if (set.dynamaxLevel !== undefined && set.dynamaxLevel !== 10) {
    lines.push(`Dynamax Level: ${set.dynamaxLevel}`);
  }
  if (set.gigantamax) lines.push('Gigantamax: Yes');
  if (set.teraType) lines.push(`Tera Type: ${set.teraType}`);
  const evs = formatSpread(set.evs, options.defaultEv ?? 0);
  if (evs) lines.push(`EVs: ${evs}`);
  if (set.nature) lines.push(`${set.nature} Nature`);
  const ivs = formatSpread(set.ivs, 31);
  if (ivs) lines.push(`IVs: ${ivs}`);
  for (const move of set.moves) {
    lines.push(
      toShowdownId(move) === 'hiddenpower' && set.hpType
        ? `- Hidden Power [${set.hpType}]`
        : `- ${move}`,
    );
  }
  return lines.join('\n');
}

/** A team as Showdown text; with a name, prefixed by its `=== [format] Name ===` header. */
export function exportShowdownTeam(
  sets: readonly ShowdownSet[],
  header?: { readonly name: string; readonly format?: string | null },
  options: ExportOptions = {},
): string {
  const body = sets.map((set) => exportShowdownSet(set, options)).join('\n\n');
  if (!header) return `${body}\n`;
  const format = header.format ? `[${header.format}] ` : '';
  return `=== ${format}${header.name} ===\n\n${body}\n`;
}

/** Gen 1–2 DV from a Showdown IV (Showdown stores IVs 0–31 in every generation). */
export function dvFromIv(iv: number): number {
  return Math.floor(iv / 2);
}

/** Showdown IV for a Gen 1–2 DV (15 → 31, the default; others → 2 × DV). */
export function ivFromDv(dv: number): number {
  return dv === 15 ? 31 : dv * 2;
}
