import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SPACING } from '@thedex/ui-tokens';
import { useGame } from '../../shared/game/GameProvider';
import { Icon } from '../../shared/ui/Icon';
import { Chip } from '../../shared/ui/primitives';

/** Header of the tab screens: the selected game (RF01.2 selector) and Settings. */
export function HeaderActions() {
  const { t } = useTranslation();
  const { game } = useGame();
  return (
    <View style={styles.row}>
      <Chip
        label={game.name}
        onPress={() => router.push('/game')}
        accessibilityLabel={t('nav.selectGame')}
      />
      <Pressable
        onPress={() => router.push('/settings')}
        accessibilityRole="button"
        accessibilityLabel={t('nav.settings')}
        hitSlop={8}
        style={styles.settings}
      >
        <Icon name="cog" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingRight: SPACING.md },
  settings: { marginBottom: SPACING.sm },
});
