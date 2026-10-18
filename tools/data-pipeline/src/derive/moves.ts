import { isTypeName, legacyDamageClass } from '@thedex/engine';
import type { BuildContext } from '../context';
import { toInt, toIntRequired, type SqlValue } from '../values';

const FIELDS = [
  'type_id',
  'power',
  'pp',
  'accuracy',
  'priority',
  'target_id',
  'effect_id',
  'effect_chance',
] as const;
type Field = (typeof FIELDS)[number];
type MoveValues = Record<Field, number | null>;

/** Physical/special split arrived in Gen 4. */
const SPLIT_GENERATION = 4;
const SHADOW_ONLY_VERSION_GROUPS = new Set(['colosseum', 'xd']);

/**
 * Builds move_stats_by_vg. PokeAPI `move_changelog` rows hold the values a move had
 * BEFORE `changed_in_version_group_id`; for a version group V, each field comes from the
 * earliest later change that recorded it, else from the current value.
 */
export function deriveMoveStats(ctx: BuildContext): void {
  const versionGroups = ctx.all<{
    id: number;
    identifier: string;
    generation_id: number;
    sort_order: number;
  }>('SELECT id, identifier, generation_id, sort_order FROM version_groups ORDER BY sort_order');
  const vgOrder = new Map(versionGroups.map((vg) => [vg.id, vg.sort_order]));
  const typeIdentifiers = new Map(
    ctx
      .all<{ id: number; identifier: string }>('SELECT id, identifier FROM types')
      .map((t) => [t.id, t.identifier]),
  );
  const damageClassIds = new Map(
    ctx
      .all<{ id: number; identifier: string }>('SELECT id, identifier FROM move_damage_classes')
      .map((d) => [d.identifier, d.id]),
  );
  const statusClass = damageClassIds.get('status');

  const changelog = new Map<number, { order: number; values: MoveValues }[]>();
  for (const row of ctx.csv('move_changelog')) {
    const moveId = toIntRequired(row.move_id);
    const order = vgOrder.get(toIntRequired(row.changed_in_version_group_id));
    if (order === undefined) continue;
    const values = Object.fromEntries(FIELDS.map((f) => [f, toInt(row[f])])) as MoveValues;
    const list = changelog.get(moveId) ?? [];
    list.push({ order, values });
    changelog.set(moveId, list);
  }
  for (const list of changelog.values()) list.sort((a, b) => a.order - b.order);

  const rows: SqlValue[][] = [];
  for (const row of ctx.csv('moves')) {
    const moveId = toIntRequired(row.id);
    const generation = toIntRequired(row.generation_id);
    const current = Object.fromEntries(FIELDS.map((f) => [f, toInt(row[f])])) as MoveValues;
    const currentClass = toIntRequired(row.damage_class_id);
    const isShadow = typeIdentifiers.get(current.type_id ?? -1) === 'shadow';
    const changes = changelog.get(moveId) ?? [];

    for (const vg of versionGroups) {
      if (vg.generation_id < generation) continue;
      if (isShadow && !SHADOW_ONLY_VERSION_GROUPS.has(vg.identifier)) continue;

      const values = { ...current };
      for (const field of FIELDS) {
        const change = changes.find((c) => c.order > vg.sort_order && c.values[field] !== null);
        if (change) values[field] = change.values[field];
      }

      let damageClass = currentClass;
      const typeIdentifier = typeIdentifiers.get(values.type_id ?? -1) ?? '';
      if (
        vg.generation_id < SPLIT_GENERATION &&
        currentClass !== statusClass &&
        isTypeName(typeIdentifier) &&
        typeIdentifier !== 'fairy'
      ) {
        damageClass = damageClassIds.get(legacyDamageClass(typeIdentifier)) ?? currentClass;
      }

      rows.push([
        moveId,
        vg.id,
        values.type_id,
        values.power,
        values.pp,
        values.accuracy,
        values.priority ?? 0,
        damageClass,
        values.target_id,
        values.effect_id,
        values.effect_chance,
      ]);
    }
  }

  const inserted = ctx.insert(
    'move_stats_by_vg',
    [
      'move_id',
      'version_group_id',
      'type_id',
      'power',
      'pp',
      'accuracy',
      'priority',
      'damage_class_id',
      'target_id',
      'effect_id',
      'effect_chance',
    ],
    rows,
  );
  ctx.log(`  move_stats_by_vg: ${inserted}`);
}
