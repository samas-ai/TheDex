import type { BuildContext } from '../context';
import type { SqlValue } from '../values';

/** species_tags: PokeAPI flags (legendary/mythical/baby) + curated categories. */
export function deriveSpeciesTags(ctx: BuildContext): void {
  ctx.db.exec(`
    INSERT INTO species_tags (species_id, tag)
    SELECT id, 'legendary' FROM pokemon_species WHERE is_legendary = 1
    UNION ALL SELECT id, 'mythical' FROM pokemon_species WHERE is_mythical = 1
    UNION ALL SELECT id, 'baby' FROM pokemon_species WHERE is_baby = 1;`);

  const species = new Map(
    ctx
      .all<{ id: number; identifier: string }>('SELECT id, identifier FROM pokemon_species')
      .map((row) => [row.identifier, row.id]),
  );
  const rows: SqlValue[][] = [];
  const unknown: string[] = [];
  for (const [tag, identifiers] of Object.entries(ctx.curated.speciesTags)) {
    for (const identifier of identifiers) {
      const id = species.get(identifier);
      if (id === undefined) unknown.push(`${tag}:${identifier}`);
      else rows.push([id, tag]);
    }
  }
  if (unknown.length > 0 && !ctx.options.allowMissingCsv) {
    throw new Error(`species-tags.json: unknown species ${unknown.join(', ')}`);
  }
  const inserted = ctx.insert('species_tags', ['species_id', 'tag'], rows, { orIgnore: true });
  ctx.log(`  species_tags: +${inserted} curated`);
}

/** i18n table → entity table holding the PokeAPI identifiers. */
const PT_BR_TARGETS: Readonly<Record<string, { entityTable: string; idColumn: string }>> = {
  type_i18n: { entityTable: 'types', idColumn: 'type_id' },
  nature_i18n: { entityTable: 'natures', idColumn: 'nature_id' },
  stat_i18n: { entityTable: 'stats', idColumn: 'stat_id' },
  flavor_i18n: { entityTable: 'flavors', idColumn: 'flavor_id' },
  move_damage_class_i18n: { entityTable: 'move_damage_classes', idColumn: 'damage_class_id' },
};

/** Entities that must be fully translated in pt-BR (18 types, 25 natures, 6 battle stats). */
export const PT_BR_REQUIRED: Readonly<
  Record<string, { entityTable: string; idColumn: string; where: string }>
> = {
  type_i18n: { entityTable: 'types', idColumn: 'type_id', where: 'id BETWEEN 1 AND 18' },
  nature_i18n: { entityTable: 'natures', idColumn: 'nature_id', where: '1 = 1' },
  stat_i18n: { entityTable: 'stats', idColumn: 'stat_id', where: 'id BETWEEN 1 AND 6' },
};

/** Writes `lang = 'pt-BR'` rows from data/curated/i18n-pt-BR.json. */
export function derivePtBr(ctx: BuildContext): void {
  let total = 0;
  for (const [table, entries] of Object.entries(ctx.curated.ptBr)) {
    const target = PT_BR_TARGETS[table];
    if (!target) throw new Error(`i18n-pt-BR.json: unsupported table "${table}"`);
    const ids = new Map(
      ctx
        .all<{ id: number; identifier: string }>(
          `SELECT id, identifier FROM "${target.entityTable}"`,
        )
        .map((row) => [row.identifier, row.id]),
    );
    const rows: SqlValue[][] = [];
    for (const [identifier, { name }] of Object.entries(entries)) {
      const id = ids.get(identifier);
      if (id === undefined) {
        if (ctx.options.allowMissingCsv) continue;
        throw new Error(`i18n-pt-BR.json: unknown ${target.entityTable} "${identifier}"`);
      }
      rows.push([id, 'pt-BR', name]);
    }
    total += ctx.insert(table, [target.idColumn, 'lang', 'name'], rows, { orReplace: true });

    const required = PT_BR_REQUIRED[table];
    if (required && !ctx.options.allowMissingCsv) {
      const missing = ctx
        .all<{ identifier: string }>(
          `SELECT identifier FROM "${required.entityTable}" WHERE ${required.where}`,
        )
        .filter((row) => !(row.identifier in entries))
        .map((row) => row.identifier);
      if (missing.length > 0) {
        throw new Error(`i18n-pt-BR.json: ${table} missing ${missing.join(', ')}`);
      }
    }
  }
  ctx.log(`  pt-BR curated names: ${total}`);
}

/**
 * ability_prose_i18n.overworld_effect (RF04.1) from data/curated/ability-overworld.json:
 * effects outside battle, which PokeAPI does not describe.
 */
export function deriveAbilityOverworld(ctx: BuildContext): void {
  const ids = new Map(
    ctx
      .all<{ id: number; identifier: string }>('SELECT id, identifier FROM abilities')
      .map((row) => [row.identifier, row.id]),
  );
  const languages = new Set(
    ctx.all<{ code: string }>('SELECT code FROM languages').map((row) => row.code),
  );
  const upsert = ctx.db.prepare(`
    INSERT INTO ability_prose_i18n (ability_id, lang, overworld_effect) VALUES (?, ?, ?)
    ON CONFLICT (ability_id, lang) DO UPDATE SET overworld_effect = excluded.overworld_effect`);
  let total = 0;
  ctx.db.transaction(() => {
    for (const [identifier, texts] of Object.entries(ctx.curated.abilityOverworld)) {
      const id = ids.get(identifier);
      if (id === undefined) {
        if (ctx.options.allowMissingCsv) continue;
        throw new Error(`ability-overworld.json: unknown ability "${identifier}"`);
      }
      for (const [lang, text] of Object.entries(texts)) {
        if (!languages.has(lang)) {
          if (ctx.options.allowMissingCsv) continue;
          throw new Error(`ability-overworld.json: unknown language "${lang}" (${identifier})`);
        }
        upsert.run(id, lang, text);
        total++;
      }
    }
  })();
  ctx.log(`  ability overworld effects: ${total}`);
}
