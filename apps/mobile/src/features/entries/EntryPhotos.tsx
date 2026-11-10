import { useState } from 'react';
import { type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, View } from 'react-native';

import type { EntryResponse } from '@/api/generated/journey';
import { ClipBadge } from '@/features/media/ClipPlayer';
import { HeldVeil } from '@/features/safety/Held';
import { type Radius, radius as radii, useTheme } from '@/theme';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { words } from '@/words';

import { MilestonePill } from './MilestonePill';

type Props = {
  entry: EntryResponse;
  height: number;
  radius?: Radius;
  /** How far the labels sit from the photo's edge. */
  inset?: number;
  /** Show the Milestone label on the photo. The story line marks a milestone on its day instead. */
  milestone?: boolean;
};

/**
 * An entry's photos in a card. One photo is just the photo; several can be swiped through inside the card,
 * with "2 / 4" on the photo and dots under it. A photo that is held for review is veiled, wherever it is shown.
 */
export function EntryPhotos({ entry, height, radius = 'card', inset = 12, milestone = true }: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [at, setAt] = useState(0);
  const media = entry.media;
  const first = media[0];
  if (!first) return null;

  const labels = (index: number) => {
    const shown = media[index] ?? first;
    return (
      <>
        {milestone && entry.isMilestone ? <MilestonePill style={{ position: 'absolute', top: inset, left: inset }} /> : null}
        {media.length > 1 ? <Pill label={`${index + 1} / ${media.length}`} style={{ position: 'absolute', top: inset, right: inset }} /> : null}
        {shown.kind === 'video' ? <ClipBadge seconds={shown.durationSeconds} style={{ position: 'absolute', left: inset, bottom: inset }} /> : null}
      </>
    );
  };

  if (media.length === 1) {
    return (
      <Photo uri={first.thumbUrl ?? first.url} radius={radius} style={{ height }}>
        {first.held ? <HeldVeil /> : null}
        {labels(0)}
      </Photo>
    );
  }

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) return;
    const next = Math.min(media.length - 1, Math.max(0, Math.round(event.nativeEvent.contentOffset.x / width)));
    if (next !== at) setAt(next);
  };
  return (
    <View>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height, borderRadius: radii[radius], overflow: 'hidden', backgroundColor: colors.fill }}>
        <ScrollView horizontal pagingEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={32} accessibilityLabel={words.entry.photosSwipe(media.length)}>
          {media.map((m, index) => (
            // Only the photo in view and its neighbours are loaded; the others keep their place.
            <Photo key={m.id} uri={Math.abs(index - at) <= 1 ? (m.thumbUrl ?? m.url) : null} radius="none" style={{ width: width || 1, height }}>
              {m.held ? <HeldVeil /> : null}
            </Photo>
          ))}
        </ScrollView>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
          {labels(at)}
        </View>
      </View>
      <View accessible={false} style={{ flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 8 }}>
        {media.map((m, index) => (
          <View key={m.id} style={{ width: 6, height: 6, borderRadius: radii.pill, backgroundColor: index === at ? colors.text : colors.fill2 }} />
        ))}
      </View>
    </View>
  );
}
