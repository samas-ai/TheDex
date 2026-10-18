import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useTranslation } from 'react-i18next';
import { HeaderActions } from '../../features/navigation/HeaderActions';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon, type IconName } from '../../shared/ui/Icon';

const tabIcon =
  (name: IconName) =>
  ({ color, size }: { color: ColorValue; size: number }) => (
    // Tab colors come from the theme as strings; numeric (processed) colors never reach here.
    <Icon
      name={name}
      color={typeof color === 'number' ? undefined : (color ?? undefined)}
      size={size}
    />
  );

/**
 * Bottom tabs: the four big encyclopedias (Pokédex, moves, abilities, items) and "More"
 * (locations, types, natures, global search). Details open on the root stack, over the tabs.
 */
export default function TabsLayout() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerRight: () => <HeaderActions />,
        headerStyle: { backgroundColor: theme.colors.surface },
        headerTintColor: theme.colors.text,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarStyle: { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: t('nav.pokedex'), tabBarIcon: tabIcon('pokeball') }}
      />
      <Tabs.Screen
        name="moves"
        options={{ title: t('nav.moves'), tabBarIcon: tabIcon('sword-cross') }}
      />
      <Tabs.Screen
        name="abilities"
        options={{ title: t('nav.abilities'), tabBarIcon: tabIcon('star-four-points') }}
      />
      <Tabs.Screen
        name="items"
        options={{ title: t('nav.items'), tabBarIcon: tabIcon('bag-personal') }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: t('nav.more'), tabBarIcon: tabIcon('dots-grid') }}
      />
    </Tabs>
  );
}
