import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SPACING } from '@thedex/ui-tokens';
import { Icon, type IconName } from '../../shared/ui/Icon';

/** Header shortcuts of a profile into the tools: compare (RF10), stat and catch calculators (RF11). */
export function ProfileActions({ pokemonId, color }: { pokemonId: number; color: string }) {
  const { t } = useTranslation();
  const actions: readonly { icon: IconName; label: string; href: Href }[] = [
    { icon: 'scale-balance', label: t('profile.compare'), href: `/compare?ids=${pokemonId}` },
    {
      icon: 'calculator-variant',
      label: t('profile.statCalc'),
      href: `/calc/stats?pokemon=${pokemonId}`,
    },
    { icon: 'pokeball', label: t('profile.catchCalc'), href: `/calc/catch?pokemon=${pokemonId}` },
  ];
  return (
    <View style={styles.row}>
      {actions.map((action) => (
        <Pressable
          key={action.icon}
          onPress={() => router.push(action.href)}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={8}
        >
          <Icon name={action.icon} color={color} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: SPACING.lg },
});
