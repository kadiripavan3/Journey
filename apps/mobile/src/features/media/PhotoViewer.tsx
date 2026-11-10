import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MediaResponse } from '@/api/generated/journey';
import { darkTheme, radius } from '@/theme';
import { Frost } from '@/ui/Frost';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

import { ClipPlayer } from './ClipPlayer';

/** A photo, or a clip with what it takes to play it. */
type Shown = Pick<MediaResponse, 'id' | 'url'> & Partial<Pick<MediaResponse, 'kind' | 'playbackUrl' | 'durationSeconds' | 'status'>>;

type Props = {
  photos: Shown[];
  /** Which photo to open on; null keeps the viewer closed. */
  startAt: number | null;
  onClose: () => void;
  eyebrow?: string;
  title?: string;
};

/**
 * 6.3 Photo viewer: photos open edge to edge on black. Swipe between them; pinch to look closer; the caption
 * stays in view. A clip sits among them as its still frame with a play button (6.4) and plays when tapped.
 */
export function PhotoViewer({ photos, startAt, onClose, eyebrow, title }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [moved, setMoved] = useState<number | null>(null);
  const index = moved ?? startAt ?? 0;
  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / width);
    if (next !== index && next >= 0 && next < photos.length) setMoved(next);
  };
  const close = () => {
    setMoved(null);
    onClose();
  };

  return (
    <Modal visible={startAt !== null} animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: darkTheme.colors.black }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: (startAt ?? 0) * width, y: 0 }} onScroll={onScroll} scrollEventThrottle={32}>
          {photos.map((photo, i) =>
            photo.kind === 'video' ? (
              // Only the clip in view is drawn as a player: swiping away from a playing clip stops it.
              <View key={photo.id} style={{ width, height }}>
                {i === index ? <ClipPlayer clip={{ url: photo.url, playbackUrl: photo.playbackUrl ?? null, durationSeconds: photo.durationSeconds ?? null, status: photo.status ?? 'ready' }} /> : null}
              </View>
            ) : (
              <ScrollView key={photo.id} maximumZoomScale={3} minimumZoomScale={1} centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ width, height }}>
                <Image source={{ uri: photo.url }} style={{ width, height }} contentFit="contain" accessibilityLabel={words.media.viewer.photoSpoken(i + 1, photos.length)} />
              </ScrollView>
            ),
          )}
        </ScrollView>

        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <RoundButton tone="photo" label={words.media.viewer.close} onPress={close} icon={(c) => <X size={20} color={c} />} />
          {photos.length > 1 ? (
            <View style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: darkTheme.colors.photoGlass, borderWidth: 1, borderColor: darkTheme.colors.photoGlassLine }}>
              <Frost tone="dark" />
              <Txt variant="caption" accessibilityLiveRegion="polite" weight={700} style={{ color: darkTheme.colors.onPhoto }}>
                {words.media.viewer.position(index + 1, photos.length)}
              </Txt>
            </View>
          ) : null}
          <View style={{ width: 40 }} />
        </View>

        {/* A clip keeps the bottom of the screen for its own controls. */}
        {(eyebrow || title) && photos[index]?.kind !== 'video' ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 12) + 14, gap: 4 }}>
            {eyebrow ? (
              <Txt variant="label" numberOfLines={1} style={{ color: darkTheme.colors.accentText }}>
                {eyebrow}
              </Txt>
            ) : null}
            {title ? (
              <Txt variant="subtitle" numberOfLines={2} style={{ color: darkTheme.colors.onPhoto }}>
                {title}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
