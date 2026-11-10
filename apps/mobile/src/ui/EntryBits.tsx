import { Star } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { EntryResponse } from '@/api/generated/journey';
import { useTheme } from '@/theme';

import { Eyebrow, Photo, Pill } from './Bits';
import { Txt } from './Txt';

/** "Day 14 · Hoi An": the entry's label and, when it has one, its place. */
export function entryEyebrow(entry: EntryResponse): string {
  return entry.placeName ? `${entry.label} · ${entry.placeName}` : entry.label;
}

/** What to call an entry that has no title: the start of its text, or its label. */
export function entryHeadline(entry: EntryResponse): string {
  return entry.title || entry.body.split('\n')[0] || entry.label;
}

/** An entry as a row: small photo, label, title and a line of text. */
export function EntryRow({ entry, onPress, photo = 76 }: { entry: EntryResponse; onPress?: () => void; photo?: number }) {
  const cover = entry.media[0];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${entryEyebrow(entry)}. ${entryHeadline(entry)}`}
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, opacity: pressed ? 0.8 : 1 })}>
      {cover ? <Photo uri={cover.url} radius={16} style={{ width: photo, height: photo }} /> : null}
      <View style={{ flex: 1 }}>
        <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
        <Txt numberOfLines={2} weight={700} style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.25, marginTop: 2 }}>
          {entryHeadline(entry)}
        </Txt>
        {entry.title && entry.body ? (
          <Txt numberOfLines={2} color="muted" style={{ fontSize: 13, lineHeight: 18, marginTop: 2 }}>
            {entry.body}
          </Txt>
        ) : null}
      </View>
    </Pressable>
  );
}

/** An entry as a large post: wide photo first, then label, title and text. */
export function EntryPost({ entry, onPress, height = 214 }: { entry: EntryResponse; onPress?: () => void; height?: number }) {
  const cover = entry.media[0];
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${entryEyebrow(entry)}. ${entryHeadline(entry)}`} onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
      {cover ? (
        <Photo uri={cover.url} style={{ height, marginBottom: 12 }}>
          {entry.isMilestone ? <MilestonePill style={{ position: 'absolute', top: 12, left: 12 }} /> : null}
          {entry.media.length > 1 ? <Pill label={`1 / ${entry.media.length}`} style={{ position: 'absolute', top: 12, right: 12 }} /> : null}
        </Photo>
      ) : null}
      <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
      <Txt numberOfLines={2} weight={800} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.35, marginTop: 3 }}>
        {entryHeadline(entry)}
      </Txt>
      {entry.title && entry.body ? (
        <Txt numberOfLines={3} color="muted" style={{ fontSize: 13.5, lineHeight: 19.5, marginTop: 4 }}>
          {entry.body}
        </Txt>
      ) : null}
    </Pressable>
  );
}

export function MilestonePill({ style }: { style?: React.ComponentProps<typeof Pill>['style'] }) {
  const { colors } = useTheme();
  return <Pill tone="accent" label="Milestone" icon={() => <Star size={13} color={colors.onAccent} fill={colors.onAccent} />} style={style} />;
}
