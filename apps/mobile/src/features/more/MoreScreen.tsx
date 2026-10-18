import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { searchQuery, SEARCH_ENTITY_TYPES, type SearchHit } from '@thedex/db';
import { SPACING } from '@thedex/ui-tokens';
import { useAppDatabase } from '../../shared/db/DatabaseProvider';
import { useGame } from '../../shared/game/GameProvider';
import { useAsync } from '../../shared/hooks/useAsync';
import { useTheme } from '../../shared/theme/ThemeProvider';
import { Icon, type IconName } from '../../shared/ui/Icon';
import { LinkRow } from '../../shared/ui/LinkRow';
import { Card, Loading, Message, Section } from '../../shared/ui/primitives';
import { SearchField } from '../../shared/ui/SearchField';

const RESULTS_PER_TYPE = 6;

/** Where a search hit opens. */
export function hitHref(hit: Pick<SearchHit, 'entityType' | 'entityId'>): Href {
  switch (hit.entityType) {
    case 'pokemon':
      return `/pokemon/${hit.entityId}`;
    case 'move':
      return `/move/${hit.entityId}`;
    case 'ability':
      return `/ability/${hit.entityId}`;
    case 'item':
      return `/item/${hit.entityId}`;
    case 'location':
      return `/location/${hit.entityId}`;
    case 'type':
      return `/types?type=${hit.entityId}`;
    case 'nature':
      return '/natures';
  }
}

/** "More": global search over every encyclopedia (RNF07), the secondary Dexes and the app. */
export function MoreScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useAppDatabase();
  const { ctx, game } = useGame();
  const [query, setQuery] = useState('');
  const text = query.trim();
  const search = useAsync(
    async () =>
      text === '' ? null : searchQuery(db, text, ctx, { limitPerType: RESULTS_PER_TYPE }),
    [db, ctx, text],
  );
  const entry = (icon: IconName) => <Icon name={icon} color={theme.colors.primary} />;

  return (
    <ScrollView
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.search}>
        <SearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('more.searchPlaceholder')}
        />
      </View>
      {text !== '' ? (
        !search.data ? (
          <Loading />
        ) : search.data.hits.length === 0 ? (
          <Message text={t('more.noResults')} />
        ) : (
          SEARCH_ENTITY_TYPES.filter((type) => search.data!.byType[type]?.length).map((type) => (
            <Section key={type} title={t(`more.entityTypes.${type}`)}>
              <Card>
                {search.data!.byType[type]!.map((hit) => (
                  <LinkRow
                    key={hit.entityId}
                    title={hit.name}
                    subtitle={hit.matched !== hit.name ? hit.matched : null}
                    onPress={() => router.push(hitHref(hit))}
                  />
                ))}
              </Card>
            </Section>
          ))
        )
      ) : (
        <>
          <Section title={t('more.encyclopedias')}>
            <Card>
              <LinkRow
                title={t('nav.locations')}
                subtitle={t('more.locationsHint')}
                leading={entry('map-marker-radius')}
                onPress={() => router.push('/locations')}
              />
              <LinkRow
                title={t('nav.types')}
                subtitle={t('more.typesHint')}
                leading={entry('shape')}
                onPress={() => router.push('/types')}
              />
              <LinkRow
                title={t('nav.natures')}
                subtitle={t('more.naturesHint')}
                leading={entry('leaf')}
                onPress={() => router.push('/natures')}
              />
            </Card>
          </Section>
          <Section title={t('more.app')}>
            <Card>
              <LinkRow
                title={t('nav.selectGame')}
                subtitle={game.name}
                leading={entry('gamepad-variant-outline')}
                onPress={() => router.push('/game')}
              />
              <LinkRow
                title={t('nav.settings')}
                leading={entry('cog')}
                onPress={() => router.push('/settings')}
              />
              {__DEV__ ? (
                <LinkRow
                  title={t('nav.diagnostics')}
                  leading={entry('flask-outline')}
                  onPress={() => router.push('/diagnostics')}
                />
              ) : null}
            </Card>
          </Section>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  search: { marginBottom: SPACING.lg },
});
