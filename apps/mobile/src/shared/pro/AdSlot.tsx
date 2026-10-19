import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { RADII, SPACING } from '@thedex/ui-tokens';
import { useTheme } from '../theme/ThemeProvider';
import { Icon } from '../ui/Icon';
import { ThemedText } from '../ui/primitives';
import { openPro, useFeature } from './ProProvider';

/** Where banners may appear: few, at the end of content, never between list rows. */
export const AD_PLACEMENTS = ['more', 'profile'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

/** Standard banner height (320×50), so a future ad network fills the slot without a layout shift. */
const BANNER_HEIGHT = 50;

/**
 * Reserved space for a non-intrusive banner (RNF08), hidden with `ads.removed` (PRO). No ad
 * network is integrated (the app works offline): the slot shows TheDex's own PRO banner.
 * `placement` will map to the network's ad unit.
 */
export function AdSlot({ placement }: { placement: AdPlacement }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const adsRemoved = useFeature('ads.removed');
  if (adsRemoved) return null;
  return (
    <Pressable
      onPress={openPro}
      accessibilityRole="button"
      accessibilityLabel={t('pro.banner')}
      testID={`ad-slot-${placement}`}
      style={({ pressed }) => [
        styles.slot,
        { borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Icon name="star-four-points" size={20} color={theme.colors.warning} />
      <View style={styles.text}>
        <ThemedText variant="small" bold numberOfLines={1}>
          {t('pro.bannerTitle')}
        </ThemedText>
        <ThemedText variant="caption" muted numberOfLines={1}>
          {t('pro.banner')}
        </ThemedText>
      </View>
      <ThemedText variant="caption" muted>
        {t('pro.adLabel')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  slot: {
    height: BANNER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: RADII.md,
    marginTop: SPACING.lg,
  },
  text: { flex: 1 },
});
