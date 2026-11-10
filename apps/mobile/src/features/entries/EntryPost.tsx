import { type StyleProp, View, type ViewStyle } from 'react-native';

import type { EntryResponse } from '@/api/generated/journey';
import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { Eyebrow } from '@/ui/Eyebrow';
import { Tap } from '@/ui/Motion';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

import { EntryPhotos } from './EntryPhotos';
import { entryEyebrow, entryHeadline } from './labels';
import { ReactionCounts } from './Reactions';

type Props = {
  entry: EntryResponse;
  onPress?: () => void;
  /** The height of the photo. */
  height?: number;
  /**
   * "plain" sits on a card that is already there (the Following feed, the digest): its day and place are
   * written above the title. "story" is the card on the story line, where the day has its own marker.
   */
  frame?: 'plain' | 'story';
  /** New since the reader's last visit: the story card gets an accent border. */
  fresh?: boolean;
  /** On a shared journey: who wrote it, above the photo. */
  showAuthor?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * An entry as a large post: its photos first (several can be swiped through), then the title and the start
 * of the text. The one card for an entry in a list, so a held photo is veiled wherever the entry shows.
 */
export function EntryPost({ entry, onPress, height, frame = 'plain', fresh = false, showAuthor = false, style }: Props) {
  const { colors } = useTheme();
  const story = frame === 'story';
  const hasPhoto = entry.media.length > 0;
  const author = showAuthor ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: story ? 4 : 0, marginBottom: 8, marginTop: story ? 2 : 0 }}>
      <Avatar uri={entry.author.avatarUrl} name={entry.author.displayName} size={24} />
      <Txt variant="caption" numberOfLines={1} weight={700} style={{ flex: 1 }}>
        {entry.author.displayName}
      </Txt>
    </View>
  ) : null;

  if (story) {
    return (
      <Tap accessibilityRole="button" accessibilityLabel={words.entry.cardSpoken(entryHeadline(entry), !!fresh)} onPress={onPress} scaleTo={0.985} style={style}>
        <Card style={{ padding: fresh ? 8 : 10, borderWidth: fresh ? 2 : 0, borderColor: colors.accent }}>
          {author}
          <EntryPhotos entry={entry} height={height ?? 176} radius="field" inset={10} milestone={false} />
          <Txt variant="headline" weight={800} style={{ marginTop: hasPhoto ? 8 : 2, marginHorizontal: 4 }}>
            {entryHeadline(entry)}
          </Txt>
          {entry.title && entry.body ? (
            <Txt variant="note" numberOfLines={4} color="muted" style={{ marginTop: 3, marginHorizontal: 4, marginBottom: 2 }}>
              {entry.body}
            </Txt>
          ) : null}
          <View style={{ marginHorizontal: 4, marginBottom: 2 }}>
            <ReactionCounts entry={entry} />
          </View>
        </Card>
      </Tap>
    );
  }

  return (
    <Tap accessibilityRole="button" accessibilityLabel={words.entry.rowSpoken(entryEyebrow(entry), entryHeadline(entry))} onPress={onPress} scaleTo={0.985} style={style}>
      {author}
      {hasPhoto ? (
        <View style={{ marginBottom: 12 }}>
          <EntryPhotos entry={entry} height={height ?? 214} />
        </View>
      ) : null}
      <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
      <Txt variant="subheading" numberOfLines={2} style={{ marginTop: 3 }}>
        {entryHeadline(entry)}
      </Txt>
      {entry.title && entry.body ? (
        <Txt variant="note" numberOfLines={3} color="muted" style={{ marginTop: 4 }}>
          {entry.body}
        </Txt>
      ) : null}
      <ReactionCounts entry={entry} />
    </Tap>
  );
}
