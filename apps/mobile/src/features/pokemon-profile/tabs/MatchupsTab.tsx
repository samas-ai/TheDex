import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { PokemonProfile } from '@thedex/db';
import { MatchupGroups } from '../../../entities/type/MatchupGroups';
import { defensiveGroups } from '../../../entities/type/type-matchups';
import { useGame } from '../../../shared/game/GameProvider';
import { Card, Section, ThemedText } from '../../../shared/ui/primitives';

/**
 * RF02.3: weaknesses, resistances and immunities (4× … 0×) from @thedex/engine for the typing
 * and generation of the selected game (e.g. Steel resists Ghost/Dark only before Gen 6).
 */
export function MatchupsTab({ profile }: { profile: PokemonProfile }) {
  const { t } = useTranslation();
  const { ctx } = useGame();
  return (
    <View>
      <Section title={t('profile.matchups.title')}>
        <Card>
          <MatchupGroups groups={defensiveGroups(profile.types, ctx.generationId)} />
        </Card>
      </Section>
      <ThemedText variant="caption" muted>
        {t('profile.matchups.note', { number: ctx.generationId })}
      </ThemedText>
    </View>
  );
}
