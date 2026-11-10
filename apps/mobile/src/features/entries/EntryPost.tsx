import type { EntryResponse } from '@/api/generated/journey';
import { HeldVeil } from '@/features/safety/Held';
import { Eyebrow } from '@/ui/Eyebrow';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { Txt } from '@/ui/Txt';

import { entryEyebrow, entryHeadline } from './labels';
import { MilestonePill } from './MilestonePill';
import { ReactionCounts } from './Reactions';

/** An entry as a large post: wide photo first, then label, title and text. */
export function EntryPost({ entry, onPress, height = 214 }: { entry: EntryResponse; onPress?: () => void; height?: number }) {
  const cover = entry.media[0];
  return (
    <Tap accessibilityRole="button" accessibilityLabel={`${entryEyebrow(entry)}. ${entryHeadline(entry)}`} onPress={onPress} scaleTo={0.985}>
      {cover ? (
        <Photo uri={cover.thumbUrl ?? cover.url} style={{ height, marginBottom: 12 }}>
          {cover.held ? <HeldVeil /> : null}
          {entry.isMilestone ? <MilestonePill style={{ position: 'absolute', top: 12, left: 12 }} /> : null}
          {entry.media.length > 1 ? <Pill label={`1 / ${entry.media.length}`} style={{ position: 'absolute', top: 12, right: 12 }} /> : null}
        </Photo>
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
