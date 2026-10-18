import { Dex, type Move, type Species } from '@pkmn/dex';
import type { BuildContext } from '../context';
import { toPsId, type SqlValue } from '../values';

/** Showdown move flag → PokeAPI move_flags identifier. */
const FLAG_ALIASES: Readonly<Record<string, string>> = {
  contact: 'contact',
  charge: 'charge',
  recharge: 'recharge',
  protect: 'protect',
  reflectable: 'reflectable',
  snatch: 'snatch',
  mirror: 'mirror',
  punch: 'punch',
  sound: 'sound',
  gravity: 'gravity',
  defrost: 'defrost',
  distance: 'distance',
  heal: 'heal',
  bypasssub: 'authentic',
  powder: 'powder',
  bite: 'bite',
  pulse: 'pulse',
  bullet: 'ballistic',
  nonsky: 'non-sky-battle',
  dance: 'dance',
  // Newer flags PokeAPI does not have yet.
  slicing: 'slicing',
  wind: 'wind',
};
const NEW_FLAG_NAMES: Readonly<Record<string, string>> = { slicing: 'Slicing', wind: 'Wind' };

interface Row {
  id: number;
  identifier: string;
}

class PsIndex {
  private readonly byPsId = new Map<string, number>();
  readonly unmapped: string[] = [];

  constructor(
    private readonly table: string,
    private readonly kind: string,
    private readonly ctx: BuildContext,
  ) {}

  /** Resolves and stores ps_id for each row; `candidates` lists PS IDs to try in order. */
  map<R extends Row>(
    rows: readonly R[],
    exists: (psId: string) => boolean,
    candidates: (row: R) => string[],
  ) {
    const overrides = this.ctx.curated.psIdOverrides[this.kind] ?? {};
    const update = this.ctx.db.prepare(`UPDATE "${this.table}" SET ps_id = ? WHERE id = ?`);
    this.ctx.db.transaction(() => {
      for (const row of rows) {
        const override = overrides[row.identifier];
        if (override === null) continue;
        const psId = [override, ...candidates(row)].find(
          (candidate): candidate is string => !!candidate && exists(candidate),
        );
        if (!psId) {
          this.unmapped.push(row.identifier);
          continue;
        }
        update.run(psId, row.id);
        if (!this.byPsId.has(psId)) this.byPsId.set(psId, row.id);
      }
    })();
    return this;
  }

  get(psId: string | undefined): number | null {
    return psId ? (this.byPsId.get(toPsId(psId)) ?? null) : null;
  }
}

function speciesExists(psId: string): boolean {
  return Dex.species.get(psId).exists;
}

function mapPokemon(ctx: BuildContext): PsIndex {
  const rows = ctx.all<Row & { is_default: number; species: string }>(
    `SELECT p.id, p.identifier, p.is_default, s.identifier AS species
     FROM pokemon p JOIN pokemon_species s ON s.id = p.species_id`,
  );
  return new PsIndex('pokemon', 'pokemon', ctx).map(rows, speciesExists, (row) => [
    toPsId(row.identifier),
    row.is_default === 1 ? toPsId(row.species) : '',
  ]);
}

function mapForms(ctx: BuildContext): PsIndex {
  const rows = ctx.all<Row & { is_default: number; pokemon_ps: string | null }>(
    `SELECT f.id, f.identifier, f.is_default, p.ps_id AS pokemon_ps
     FROM pokemon_forms f JOIN pokemon p ON p.id = f.pokemon_id`,
  );
  return new PsIndex('pokemon_forms', 'form', ctx).map(rows, speciesExists, (row) => [
    toPsId(row.identifier),
    row.is_default === 1 ? (row.pokemon_ps ?? '') : '',
  ]);
}

function moveCandidates(row: Row): string[] {
  return [toPsId(row.identifier.replace(/--(physical|special)$/, ''))];
}

function variantKind(move: Move): 'z' | 'max' | 'gmax' | null {
  if (move.isZ) return 'z';
  if (move.isMax === true) return 'max';
  if (typeof move.isMax === 'string') return 'gmax';
  return null;
}

function mapMoves(ctx: BuildContext): PsIndex {
  const rows = ctx.all<Row>('SELECT id, identifier FROM moves');
  const index = new PsIndex('moves', 'move', ctx).map(
    rows,
    (psId) => Dex.moves.get(psId).exists,
    moveCandidates,
  );

  // Z/Max powers, variant kind and flags come from Showdown (per-move exceptions included).
  const flagIds = new Map(
    ctx.all<Row>('SELECT id, identifier FROM move_flags').map((flag) => [flag.identifier, flag.id]),
  );
  let nextFlagId = Math.max(1000, ...flagIds.values()) + 1;
  for (const [psFlag, identifier] of Object.entries(FLAG_ALIASES)) {
    if (flagIds.has(identifier)) continue;
    ctx.insert('move_flags', ['id', 'identifier'], [[nextFlagId, identifier]]);
    ctx.insert(
      'move_flag_i18n',
      ['flag_id', 'lang', 'name', 'description'],
      [[nextFlagId, 'en', NEW_FLAG_NAMES[psFlag] ?? identifier, null]],
    );
    flagIds.set(identifier, nextFlagId++);
  }

  const updates: SqlValue[][] = [];
  const flagRows: SqlValue[][] = [];
  for (const row of ctx.all<{ id: number; ps_id: string | null }>(
    'SELECT id, ps_id FROM moves WHERE ps_id IS NOT NULL',
  )) {
    const move = Dex.moves.get(row.ps_id!);
    const kind = variantKind(move);
    updates.push([
      kind,
      kind ? null : (move.zMove?.basePower ?? null),
      kind ? null : (move.zMove?.effect ?? null),
      kind ? null : (move.maxMove?.basePower ?? null),
      row.id,
    ]);
    for (const psFlag of Object.keys(move.flags)) {
      const flagId = flagIds.get(FLAG_ALIASES[psFlag] ?? '');
      if (flagId !== undefined) flagRows.push([row.id, flagId]);
    }
  }
  const update = ctx.db.prepare(
    'UPDATE moves SET variant_kind = ?, z_power = ?, z_effect = ?, max_power = ? WHERE id = ?',
  );
  ctx.db.transaction(() => updates.forEach((values) => update.run(...values)))();
  ctx.insert('move_flag_map', ['move_id', 'flag_id'], flagRows, { orIgnore: true });
  return index;
}

function mapSimple(
  ctx: BuildContext,
  table: string,
  kind: string,
  exists: (id: string) => boolean,
) {
  const rows = ctx.all<Row>(`SELECT id, identifier FROM "${table}"`);
  return new PsIndex(table, kind, ctx).map(rows, exists, (row) => [toPsId(row.identifier)]);
}

function deriveMoveVariants(
  ctx: BuildContext,
  moves: PsIndex,
  items: PsIndex,
  pokemon: PsIndex,
): number {
  const rows: SqlValue[][] = [];
  for (const move of Dex.moves.all()) {
    const variantId = moves.get(move.id);
    if (variantId === null) continue;
    if (move.isMax === true) rows.push([variantId, 'max', null, null, null]);
    if (typeof move.isMax === 'string') {
      rows.push([variantId, 'gmax', null, null, pokemon.get(`${move.isMax}gmax`)]);
    }
    if (typeof move.isZ === 'string') {
      const crystal = Dex.items.get(move.isZ);
      if (crystal.zMoveType) rows.push([variantId, 'z', null, items.get(crystal.id), null]);
    }
  }
  for (const item of Dex.items.all()) {
    if (typeof item.zMove !== 'string' || !item.zMoveFrom) continue;
    const variantId = moves.get(item.zMove);
    if (variantId === null) continue;
    const users = item.itemUser?.length ? item.itemUser : [undefined];
    for (const user of users) {
      rows.push([
        variantId,
        'z_signature',
        moves.get(item.zMoveFrom),
        items.get(item.id),
        pokemon.get(user),
      ]);
    }
  }
  return ctx.insert(
    'move_variants',
    ['variant_move_id', 'kind', 'base_move_id', 'required_item_id', 'pokemon_id'],
    rows,
  );
}

function formChangeKind(species: Species): string {
  const forme = species.forme ?? '';
  if (forme.startsWith('Mega')) return 'mega';
  if (forme === 'Primal') return 'primal';
  if (forme === 'Gmax') return 'gmax';
  if (species.requiredItem || species.requiredItems?.length) return 'item';
  if (species.requiredMove) return 'move';
  if (species.requiredAbility) return 'ability';
  if (species.battleOnly) return 'battle';
  return 'other';
}

function deriveFormChanges(
  ctx: BuildContext,
  pokemon: PsIndex,
  items: PsIndex,
  moves: PsIndex,
  abilities: PsIndex,
): number {
  const rows: SqlValue[][] = [];
  for (const row of ctx.all<{ id: number; ps_id: string }>(
    'SELECT id, ps_id FROM pokemon WHERE ps_id IS NOT NULL AND is_default = 0',
  )) {
    const species = Dex.species.get(row.ps_id);
    const base = species.changesFrom ?? species.battleOnly;
    const baseName = Array.isArray(base) ? base[0] : base;
    const fromId = pokemon.get(baseName);
    if (fromId === null || fromId === row.id) continue;
    rows.push([
      fromId,
      row.id,
      formChangeKind(species),
      items.get(species.requiredItem ?? species.requiredItems?.[0]),
      moves.get(species.requiredMove),
      abilities.get(species.requiredAbility),
    ]);
  }
  return ctx.insert(
    'form_changes',
    ['from_pokemon_id', 'to_pokemon_id', 'kind', 'item_id', 'move_id', 'ability_id'],
    rows,
    { orIgnore: true },
  );
}

/** Merges Pokémon Showdown data (@pkmn/dex): IDs, flags, Z/Max data, form changes. */
export function derivePkmn(ctx: BuildContext): void {
  const pokemon = mapPokemon(ctx);
  const forms = mapForms(ctx);
  const moves = mapMoves(ctx);
  const abilities = mapSimple(ctx, 'abilities', 'ability', (id) => Dex.abilities.get(id).exists);
  const items = mapSimple(ctx, 'items', 'item', (id) => Dex.items.get(id).exists);
  const natures = mapSimple(ctx, 'natures', 'nature', (id) => Dex.natures.get(id).exists);

  for (const [label, index] of Object.entries({
    pokemon,
    forms,
    moves,
    abilities,
    items,
    natures,
  })) {
    if (index.unmapped.length > 0) {
      const sample = index.unmapped.slice(0, 8).join(', ');
      ctx.log(`  ps_id ${label}: ${index.unmapped.length} unmapped (e.g. ${sample})`);
    }
  }
  ctx.log(`  move_variants: ${deriveMoveVariants(ctx, moves, items, pokemon)}`);
  ctx.log(`  form_changes: ${deriveFormChanges(ctx, pokemon, items, moves, abilities)}`);
}
