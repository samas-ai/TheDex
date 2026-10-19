import { useLocalSearchParams } from 'expo-router';
import { SlotEditorScreen } from '../../../features/team-builder/SlotEditorScreen';

export default function TeamSlotRoute() {
  const { id, slot } = useLocalSearchParams<{ id: string; slot: string }>();
  return <SlotEditorScreen teamId={id} slot={Number(slot)} />;
}
