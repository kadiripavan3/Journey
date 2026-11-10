import { View } from 'react-native';

import type { EntryResponse } from '@/api/generated/journey';
import { Eyebrow } from '@/ui/Eyebrow';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Txt } from '@/ui/Txt';

import { entryEyebrow, entryHeadline } from './labels';

/** An entry as a row: small photo, label, title and a line of text. */
export function EntryRow({ entry, onPress, photo = 76 }: { entry: EntryResponse; onPress?: () => void; photo?: number }) {
  const cover = entry.media[0];
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`${entryEyebrow(entry)}. ${entryHeadline(entry)}`} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      {cover ? <Photo uri={cover.url} radius="field" style={{ width: photo, height: photo }} /> : null}
      <View style={{ flex: 1 }}>
        <Eyebrow>{entryEyebrow(entry)}</Eyebrow>
        <Txt variant="headline" numberOfLines={2} style={{ marginTop: 2 }}>
          {entryHeadline(entry)}
        </Txt>
        {entry.title && entry.body ? (
          <Txt variant="caption" weight={500} numberOfLines={2} color="muted" style={{ marginTop: 2 }}>
            {entry.body}
          </Txt>
        ) : null}
      </View>
    </Tap>
  );
}
