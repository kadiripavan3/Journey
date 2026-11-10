import { Image } from 'expo-image';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { darkTheme } from '@/theme';

import { Frost } from './Frost';
import { RoundButton } from './RoundButton';
import { Txt } from './Txt';

type Props = {
  photos: { id: string; url: string }[];
  /** Which photo to open on; null keeps the viewer closed. */
  startAt: number | null;
  onClose: () => void;
  eyebrow?: string;
  title?: string;
};

/** 6.3 Photo viewer: photos open edge to edge on black. Swipe between them; pinch to look closer; the caption stays in view. */
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
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} contentOffset={{ x: (startAt ?? 0) * width, y: 0 }} onScroll={onScroll} scrollEventThrottle={32}>
          {photos.map((photo, i) => (
            <ScrollView key={photo.id} maximumZoomScale={3} minimumZoomScale={1} centerContent showsHorizontalScrollIndicator={false} showsVerticalScrollIndicator={false} style={{ width, height }}>
              <Image source={{ uri: photo.url }} style={{ width, height }} contentFit="contain" accessibilityLabel={`Photo ${i + 1} of ${photos.length}`} />
            </ScrollView>
          ))}
        </ScrollView>

        <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <RoundButton tone="photo" label="Close photos" onPress={close} icon={(c) => <X size={20} color={c} />} />
          {photos.length > 1 ? (
            <View style={{ paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18, overflow: 'hidden', backgroundColor: darkTheme.colors.photoGlass, borderWidth: 1, borderColor: darkTheme.colors.photoGlassLine }}>
              <Frost tone="dark" />
              <Txt accessibilityLiveRegion="polite" weight={700} style={{ fontSize: 13, lineHeight: 17, color: darkTheme.colors.onPhoto }}>
                {index + 1} of {photos.length}
              </Txt>
            </View>
          ) : null}
          <View style={{ width: 40 }} />
        </View>

        {eyebrow || title ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: 20, right: 20, bottom: Math.max(insets.bottom, 12) + 14, gap: 4 }}>
            {eyebrow ? (
              <Txt variant="label" numberOfLines={1} style={{ color: darkTheme.colors.accentText }}>
                {eyebrow}
              </Txt>
            ) : null}
            {title ? (
              <Txt numberOfLines={2} weight={800} style={{ fontSize: 19, lineHeight: 24, letterSpacing: -0.4, color: darkTheme.colors.onPhoto }}>
                {title}
              </Txt>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
