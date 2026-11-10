
import type { JourneyResponse } from '@/api/generated/journey';
import { followersLabel } from '@/lib/plural';

import { Photo, Pill } from './Bits';
import { Tap } from './Motion';
import { Txt } from './Txt';

type Props = {
  journey: JourneyResponse;
  onPress?: () => void;
  /** "lg" and "sm" are fixed-width cards for a sideways rail; "grid" fills half a two-column grid. */
  size?: 'lg' | 'sm' | 'grid';
  /** A label on the photo, such as "3 new". Completed and paused journeys get one by themselves. */
  pill?: string;
  /** The line under the title. By default: where the journey has got to, and whose it is. */
  detail?: string;
  /** A second line, on large cards. By default: how many people follow. */
  footnote?: string;
};

/** A journey as a photo card: cover, title, and where it has got to. */
export function JourneyCard({ journey, onPress, size = 'lg', pill, detail, footnote }: Props) {
  const side = size === 'lg' ? 232 : size === 'sm' ? 158 : undefined;
  const label = pill ?? (journey.status === 'completed' ? 'Completed' : journey.status === 'paused' ? 'Paused' : journey.authors.length > 1 ? 'Shared' : null);
  const line = detail ?? `${journey.progressLabel} · ${journey.owner.displayName}`;
  const second = size === 'lg' ? (footnote ?? followersLabel(journey.followerCount)) : null;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${journey.title}. ${line}.${label ? ` ${label}.` : ''}`}
      onPress={onPress}
      style={{ width: side, flex: side ? undefined : 1, gap: 2 }}>
      <Photo uri={journey.coverUrl} style={{ height: side ?? 172, marginBottom: 8 }}>
        {label ? <Pill label={label} style={{ position: 'absolute', top: 12, left: 12 }} /> : null}
      </Photo>
      <Txt numberOfLines={2} weight={700} style={{ fontSize: size === 'lg' ? 15 : 14.5, lineHeight: 20, letterSpacing: -0.2 }}>
        {journey.title}
      </Txt>
      <Txt numberOfLines={1} color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
        {line}
      </Txt>
      {second ? (
        <Txt numberOfLines={1} color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
          {second}
        </Txt>
      ) : null}
    </Tap>
  );
}
