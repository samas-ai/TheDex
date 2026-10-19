import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SPACING } from '@thedex/ui-tokens';
import { PurchasePendingError, StoreUnavailableError } from '../../shared/pro/entitlement-source';
import {
  FEATURE_KEYS,
  FREE_TEAM_LIMIT,
  isFeatureEnabled,
  type FeatureKey,
} from '../../shared/pro/features';
import { usePro } from '../../shared/pro/ProProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { Button, Card, Chip, Section, styles as ui, ThemedText } from '../../shared/ui/primitives';

const FEATURE_ICONS: Readonly<Record<FeatureKey, IconName>> = {
  'ads.removed': 'cancel',
  'team.unlimited': 'account-group',
  'checklist.shiny': 'star-four-points',
  'pokedex.combinedFilters': 'filter-variant',
  'theme.amoled': 'theme-light-dark',
};

/** RNF08: what PRO unlocks, the current plan, purchase and restore. */
export function ProScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const pro = usePro();
  const [busy, setBusy] = useState(false);
  const offerPrice = pro.plan === 'free' && pro.storeAvailable;
  const { data: price } = useAsync(
    () => (offerPrice ? pro.loadPrice() : Promise.resolve(null)),
    [offerPrice, pro.loadPrice],
  );

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (e) {
      if (e instanceof PurchasePendingError) Alert.alert(t('pro.pending'));
      else if (e instanceof StoreUnavailableError) Alert.alert(t('pro.storeUnreachable'));
      else Alert.alert(t('common.error', { message: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
    >
      <View style={styles.hero}>
        <Icon name="star-four-points" size={40} color={theme.colors.warning} />
        <ThemedText variant="headline">TheDex PRO</ThemedText>
        <ThemedText muted style={styles.center}>
          {t('pro.tagline')}
        </ThemedText>
        <Chip
          label={pro.plan === 'pro' ? t('pro.planPro') : t('pro.planFree')}
          selected={pro.plan === 'pro'}
        />
      </View>

      <Section title={t('pro.benefits')}>
        <Card>
          {FEATURE_KEYS.map((key) => {
            const unlocked = isFeatureEnabled(key, pro.plan);
            return (
              <View key={key} style={styles.feature}>
                <Icon name={FEATURE_ICONS[key]} color={theme.colors.primary} />
                <View style={styles.flex}>
                  <ThemedText bold>{t(`pro.features.${key}.title`)}</ThemedText>
                  <ThemedText variant="small" muted>
                    {t(`pro.features.${key}.hint`, { limit: FREE_TEAM_LIMIT })}
                  </ThemedText>
                </View>
                <Icon
                  name={unlocked ? 'check-circle' : 'lock'}
                  size={20}
                  color={unlocked ? theme.colors.success : theme.colors.textMuted}
                />
              </View>
            );
          })}
        </Card>
      </Section>

      {pro.plan === 'free' ? (
        <View style={styles.actions}>
          <Button
            label={price ? t('pro.buyFor', { price }) : t('pro.buy')}
            onPress={() => void run(pro.purchase)}
            disabled={busy || !pro.storeAvailable}
          />
          {pro.storeAvailable ? (
            <ThemedText variant="small" muted style={styles.center}>
              {t('pro.oneTime')}
            </ThemedText>
          ) : (
            <ThemedText variant="small" muted style={styles.center}>
              {t('pro.storeUnavailable')}
            </ThemedText>
          )}
          <Button
            label={t('pro.restore')}
            onPress={() => void run(pro.restore)}
            disabled={busy || !pro.storeAvailable}
            color={theme.colors.surfaceVariant}
            textColor={theme.colors.text}
          />
        </View>
      ) : null}

      {pro.simulate ? (
        <Section title={t('pro.simulate')}>
          <Card>
            <ThemedText variant="small" muted>
              {t('pro.simulateHint')}
            </ThemedText>
            <View style={ui.wrap}>
              {([null, 'free', 'pro'] as const).map((plan) => (
                <Chip
                  key={plan ?? 'store'}
                  label={
                    plan === null
                      ? t('pro.simulateStore')
                      : plan === 'pro'
                        ? t('pro.planPro')
                        : t('pro.planFree')
                  }
                  selected={pro.simulated === plan}
                  onPress={() => pro.simulate?.(plan)}
                />
              ))}
            </View>
          </Card>
        </Section>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  hero: { alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.lg },
  center: { textAlign: 'center' },
  feature: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: 4 },
  flex: { flex: 1 },
  actions: { gap: SPACING.sm, marginBottom: SPACING.lg },
});
