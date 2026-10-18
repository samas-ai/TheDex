import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TypeAccent } from '@thedex/ui-tokens';
import { useMediaService } from '../../shared/media/MediaProvider';
import { Chip } from '../../shared/ui/primitives';

/** RF02.1: plays the cry (legacy cries in Gen 1–5 games). Downloaded on first tap. */
export function CryButton({
  pokemonId,
  generationId,
  accent,
}: {
  pokemonId: number;
  generationId: number;
  accent: TypeAccent;
}) {
  const { t } = useTranslation();
  const media = useMediaService();
  const player = useRef<AudioPlayer | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'unavailable'>('idle');

  useEffect(
    () => () => {
      player.current?.remove();
      player.current = null;
    },
    [],
  );
  useEffect(() => setState('idle'), [pokemonId, generationId]);

  if (!media.canPlayCries) {
    return (
      <Chip
        label={t('profile.cryUnavailable')}
        disabled
        accessibilityLabel={t('profile.cryIosPending')}
      />
    );
  }

  const play = async () => {
    setState('loading');
    const uri = await media.cry(pokemonId, generationId);
    if (!uri) {
      setState('unavailable');
      return;
    }
    if (player.current) {
      player.current.replace({ uri });
    } else {
      player.current = createAudioPlayer({ uri });
    }
    await player.current.seekTo(0);
    player.current.play();
    setState('idle');
  };

  return (
    <Chip
      label={state === 'unavailable' ? t('profile.cryUnavailable') : `♪ ${t('profile.playCry')}`}
      selected
      selectedColor={accent.base}
      selectedTextColor={accent.onBase}
      disabled={state === 'loading'}
      onPress={() => void play()}
    />
  );
}
