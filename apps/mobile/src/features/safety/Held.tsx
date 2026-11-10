import { useRouter } from 'expo-router';
import { ChevronRight, ShieldAlert } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';

import type { EntryResponse } from '@/api/generated/journey';
import { darkTheme, radius, useTheme, withAlpha } from '@/theme';
import { Frost } from '@/ui/Frost';
import { Tap } from '@/ui/Motion';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** How many of an entry's photos are waiting for a reviewer. Only the person who posted them ever gets more than none. */
export function heldCount(entry: EntryResponse): number {
  return entry.media.filter((m) => m.held).length;
}

/**
 * What lies over a photo that is being reviewed: the photo is blurred, with a shield and "Hidden for now".
 * Put it last inside the photo's box. Small photos get the shield only.
 */
export function HeldVeil({ small }: { small?: boolean }) {
  const on = darkTheme.colors.onPhoto;
  return (
    <View
      accessible
      accessibilityLabel={words.safety.held.photoSpoken}
      style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', gap: 6, overflow: 'hidden', backgroundColor: withAlpha(darkTheme.colors.stage, 0.35) }]}>
      <Frost tone="dark" intensity={70} />
      <ShieldAlert size={small ? 20 : 24} color={on} />
      {small ? null : (
        <Txt variant="footnote" weight={800} style={{ color: on }}>
          {words.safety.held.hidden}
        </Txt>
      )}
    </View>
  );
}

/** On your own entry: a line saying a photo is being reviewed, which opens the page that explains it. */
export function HeldNote({ entry }: { entry: EntryResponse }) {
  const router = useRouter();
  const { colors } = useTheme();
  const held = heldCount(entry);
  if (held === 0) return null;
  const what = words.safety.held.photos(held);
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={words.safety.held.photosSpoken(what)}
      scaleTo={0.985}
      onPress={() => router.push(`/review/${entry.id}`)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, paddingVertical: 11, paddingHorizontal: 12, borderRadius: radius.field, backgroundColor: colors.fill }}>
      <ShieldAlert size={18} color={colors.warn} />
      <View style={{ flex: 1 }}>
        <Txt variant="caption" weight={800}>
          {what}
        </Txt>
        <Txt variant="small" color="muted">
          {words.safety.held.onlyYou}
        </Txt>
      </View>
      <ChevronRight size={16} color={colors.muted} />
    </Tap>
  );
}

/** Under your own comment while the word filter has it waiting for a reviewer. */
export function HeldCommentNote() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
      <ShieldAlert size={14} color={colors.warn} />
      <Txt variant="footnote" weight={600} color="muted" style={{ flex: 1 }}>
        {words.safety.held.comment}
      </Txt>
    </View>
  );
}
