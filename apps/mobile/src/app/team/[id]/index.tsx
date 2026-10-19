import { useLocalSearchParams } from 'expo-router';
import { TeamEditorScreen } from '../../../features/team-builder/TeamEditorScreen';

export default function TeamRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TeamEditorScreen teamId={id} />;
}
