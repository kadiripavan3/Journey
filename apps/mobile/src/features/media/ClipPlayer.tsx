import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Play } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, type StyleProp, View, type ViewStyle } from 'react-native';

import type { MediaResponse } from '@/api/generated/journey';
import { darkTheme, radius } from '@/theme';
import { Frost } from '@/ui/Frost';
import { Pill } from '@/ui/Pill';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

import { clipLength } from './clips';

/** What the player needs to know about a clip; a `MediaResponse` fits. */
export type Clip = Pick<MediaResponse, 'url' | 'playbackUrl' | 'durationSeconds' | 'status'>;

/**
 * 6.4 Clip: the clip's still frame with a glass play button and its length. It plays when tapped and never
 * by itself, so nothing moves or makes a sound until the person asks. A clip that is still being converted
 * (only its author sees those) says so instead.
 */
export function ClipPlayer({ clip, fit = 'contain', style }: { clip: Clip; fit?: 'contain' | 'cover'; style?: StyleProp<ViewStyle> }) {
  const [playing, setPlaying] = useState(false);
  const length = clipLength(clip.durationSeconds);
  const ready = clip.status === 'ready' && !!clip.playbackUrl;
  const c = darkTheme.colors;

  if (playing && clip.playbackUrl) {
    return (
      <View style={[{ flex: 1, backgroundColor: c.black }, style]}>
        <Playing uri={clip.playbackUrl} fit={fit} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={ready ? words.media.clip.playSpoken(length) : clip.status === 'failed' ? words.media.clip.failedSpoken : words.media.clip.preparingSpoken}
      accessibilityState={{ disabled: !ready }}
      disabled={!ready}
      onPress={() => setPlaying(true)}
      style={[{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.black }, style]}>
      <Image source={{ uri: clip.url }} style={StyleSheet.absoluteFill} contentFit={fit} accessible={false} />
      {ready ? (
        <>
          <View style={{ width: 76, height: 76, borderRadius: radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: c.photoGlass, borderWidth: 1, borderColor: c.photoGlassLine }}>
            <Frost tone="dark" />
            <Play size={30} color={c.onPhoto} fill={c.onPhoto} style={{ marginLeft: 4 }} />
          </View>
          <Txt variant="caption" weight={700} style={{ marginTop: 12, color: c.onPhoto }}>
            {words.media.clip.tapToPlay(length)}
          </Txt>
        </>
      ) : (
        <View style={{ maxWidth: 260, paddingVertical: 12, paddingHorizontal: 16, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: c.photoGlass, borderWidth: 1, borderColor: c.photoGlassLine }}>
          <Frost tone="dark" />
          <Txt variant="caption" weight={700} center style={{ color: c.onPhoto }}>
            {clip.status === 'failed' ? words.media.clip.failed : words.media.clip.preparing}
          </Txt>
        </View>
      )}
    </Pressable>
  );
}

/** Made only once the person taps play, so a clip that is never played is never loaded. */
function Playing({ uri, fit }: { uri: string; fit: 'contain' | 'cover' }) {
  const player = useVideoPlayer(uri, (created) => {
    created.loop = false;
    created.play();
  });
  // In a browser the player can only start once its picture is on the page, so it is asked again then.
  useEffect(() => {
    player.play();
  }, [player]);
  return <VideoView player={player} style={{ flex: 1 }} contentFit={fit} nativeControls allowsPictureInPicture={false} />;
}

/** The mark on a card's photo that says "this one is a clip", with its length. `compact` is only the triangle, for small thumbnails. */
export function ClipBadge({ seconds, compact, style }: { seconds?: number | null; compact?: boolean; style?: StyleProp<ViewStyle> }) {
  const c = darkTheme.colors;
  if (compact) {
    return (
      <View accessible={false} style={[{ width: 26, height: 26, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: c.photoGlass }, style]}>
        <Play size={12} color={c.onPhoto} fill={c.onPhoto} style={{ marginLeft: 1 }} />
      </View>
    );
  }
  return <Pill tone="photo" label={clipLength(seconds) || words.media.clip.badge} icon={(color) => <Play size={10} color={color} fill={color} />} style={style} />;
}
