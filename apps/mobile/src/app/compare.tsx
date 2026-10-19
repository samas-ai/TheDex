import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { parseCompareIds } from '../features/comparator/compare-logic';
import { ComparatorScreen } from '../features/comparator/ComparatorScreen';

export default function CompareRoute() {
  const { ids } = useLocalSearchParams<{ ids?: string }>();
  // The screen owns the list after the first render (it rewrites `ids` as columns change).
  const [initialIds] = useState(() => parseCompareIds(ids));
  return <ComparatorScreen initialIds={initialIds} />;
}
