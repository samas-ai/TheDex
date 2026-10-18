import type { BuildContext } from '../context';

/** Item Dex groups (RF05.1), in display order. Mirrors ITEM_GROUPS in @thedex/db. */
export const ITEM_GROUP_IDS = [
  'held',
  'berry',
  'machine',
  'medicine',
  'ball',
  'evolution',
  'treasure',
  'key',
  'other',
] as const;
export type ItemGroupId = (typeof ITEM_GROUP_IDS)[number];

/**
 * PokeAPI item categories that decide the group on their own. `held` covers what a Pokémon
 * holds in battle and the in-battle items (X items, flutes): the spec's "battle items".
 */
const CATEGORY_GROUPS: Readonly<Record<string, ItemGroupId>> = {
  'held-items': 'held',
  choice: 'held',
  'effort-training': 'held',
  'bad-held-items': 'held',
  training: 'held',
  plates: 'held',
  'species-specific': 'held',
  'type-enhancement': 'held',
  scarves: 'held',
  jewels: 'held',
  'mega-stones': 'held',
  memories: 'held',
  'z-crystals': 'held',
  evolution: 'evolution',
  loot: 'treasure',
  collectibles: 'treasure',
  // Fossils (and Honey): Sword/Shield keeps them in the Treasures pocket.
  'dex-completion': 'treasure',
  // Key items no game uses.
  unused: 'other',
};

/** Fallback by bag pocket. */
const POCKET_GROUPS: Readonly<Record<string, ItemGroupId>> = {
  battle: 'held',
  berries: 'berry',
  machines: 'machine',
  medicine: 'medicine',
  pokeballs: 'ball',
  key: 'key',
};

export function itemGroup(category: string, pocket: string): ItemGroupId {
  return CATEGORY_GROUPS[category] ?? POCKET_GROUPS[pocket] ?? 'other';
}

/** items.app_group from each item's category and pocket. */
export function deriveItemGroups(ctx: BuildContext): void {
  const rows = ctx.all<{ id: number; category: string; pocket: string }>(`
    SELECT i.id, c.identifier AS category, p.identifier AS pocket
    FROM items i JOIN item_categories c ON c.id = i.category_id
    JOIN item_pockets p ON p.id = c.pocket_id`);
  const update = ctx.db.prepare('UPDATE items SET app_group = ? WHERE id = ?');
  const counts = new Map<ItemGroupId, number>();
  ctx.db.transaction(() => {
    for (const row of rows) {
      const group = itemGroup(row.category, row.pocket);
      counts.set(group, (counts.get(group) ?? 0) + 1);
      update.run(group, row.id);
    }
  })();
  const summary = ITEM_GROUP_IDS.map((group) => `${group} ${counts.get(group) ?? 0}`).join(', ');
  ctx.log(`  item groups: ${summary}`);
}
