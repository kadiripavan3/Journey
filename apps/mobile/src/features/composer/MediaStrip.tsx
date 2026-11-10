import { useVideoPlayer, VideoView } from 'expo-video';
import { ImagePlus, X } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';

import { ClipBadge } from '@/features/media/ClipPlayer';
import { MAX_CLIPS, MAX_PHOTOS } from '@/features/media/pick';
import { HeldVeil } from '@/features/safety/Held';
import { layout, radius, useTheme } from '@/theme';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Txt } from '@/ui/Txt';

import type { Shot } from './useComposer';

type Props = {
  shots: Shot[];
  /** "Photo 2", "Clip 1": what each one is called, in the same order. */
  names: string[];
  /** Media ids of photos that are held for review. They are shown veiled here too. */
  heldIds: Set<string>;
  onRemove: (key: string) => void;
  /** Left out when the entry is full. */
  onAdd?: () => void;
  /** Whether clips can be added as well as photos. */
  clips: boolean;
  photoCount: number;
  clipCount: number;
  /** A sentence about what the picker left out, if anything. */
  leftOut: string | null;
  /** The picker is open, or the entry is being sent: nothing can be added or removed. */
  locked: boolean;
};

/** The composer's strip of photos and clips: each can be taken out, and the last tile adds more. */
export function MediaStrip({ shots, names, heldIds, onRemove, onAdd, clips, photoCount, clipCount, leftOut, locked }: Props) {
  const { colors } = useTheme();
  const what = clips ? 'photos or clips' : 'photos';
  return (
    <View style={{ gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: layout.barGutter }} keyboardShouldPersistTaps="handled">
        {shots.map((shot, index) => {
          const clip = shot.kind === 'video';
          const name = names[index] ?? 'Photo';
          const held = !!shot.mediaId && heldIds.has(shot.mediaId);
          return (
            <View key={shot.key} style={{ width: 104, height: 140 }}>
              {clip && !shot.mediaId ? (
                <View style={{ flex: 1, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: colors.fill }}>
                  <ClipFrame uri={shot.uri} />
                </View>
              ) : (
                <Photo uri={shot.uri} radius="photo" label={name} style={{ flex: 1 }}>
                  {held ? <HeldVeil small /> : null}
                </Photo>
              )}
              {clip ? <ClipBadge seconds={shot.durationSeconds} style={{ position: 'absolute', left: 7, bottom: 7 }} /> : null}
              {/* Drawn small, as designed; the touch area around it is 44 pt. */}
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`Remove ${name.toLowerCase()}`}
                hitSlop={10}
                disabled={locked}
                scaleTo={0.9}
                onPress={() => onRemove(shot.key)}
                style={{ position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.photoGlass }}>
                <X size={13} color={colors.onPhoto} strokeWidth={2.6} />
              </Tap>
            </View>
          );
        })}
        {onAdd ? (
          <Tap
            accessibilityRole="button"
            accessibilityLabel={shots.length === 0 ? `Add ${what}` : `Add more ${what}`}
            disabled={locked}
            onPress={onAdd}
            style={{ width: 104, height: 140, borderRadius: radius.photo, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: colors.fill2, opacity: locked ? 0.6 : 1 }}>
            <ImagePlus size={22} color={colors.muted} />
            <Txt variant="footnote" color="muted" weight={700} center style={{ marginHorizontal: 8 }}>
              {shots.length === 0 ? (clips ? 'Photos or clips' : 'Photos') : 'Add'}
            </Txt>
          </Tap>
        ) : null}
      </ScrollView>
      {shots.length > 0 || leftOut ? (
        <Txt variant="footnote" color="muted" accessibilityLiveRegion="polite" style={{ marginHorizontal: layout.barGutter }}>
          {shots.length > 0 ? `${photoCount} of ${MAX_PHOTOS} photos${clips || clipCount > 0 ? ` · ${clipCount} of ${MAX_CLIPS} clips` : ''}` : ''}
          {leftOut ? `${shots.length > 0 ? '. ' : ''}${leftOut}` : ''}
        </Txt>
      ) : null}
    </View>
  );
}

/** A clip that is still on the phone, shown by its first frame. It doesn't play here. */
function ClipFrame({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (created) => {
    created.muted = true;
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} accessible={false} />;
}
