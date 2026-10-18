import { useTranslation } from 'react-i18next';
import { POKEDEX_SORT_KEYS } from '@thedex/db';
import { SortSheet as KeySortSheet } from '../../shared/ui/SortSheet';
import { nextSort, type PokedexSort } from './pokedex-state';

/** RF01.4: number (regional/national), name, height, weight and every base stat. */
export function SortSheet({
  visible,
  sort,
  onChange,
  onClose,
}: {
  visible: boolean;
  sort: PokedexSort;
  onChange: (sort: PokedexSort) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <KeySortSheet
      visible={visible}
      keys={POKEDEX_SORT_KEYS}
      labelOf={(key) => t(`pokedex.sortKeys.${key}`)}
      sort={sort}
      onSelect={(key) => onChange(nextSort(sort, key))}
      onClose={onClose}
    />
  );
}
