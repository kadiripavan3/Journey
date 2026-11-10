import type { JourneyResponse } from '@/api/generated/journey';
import { followersLabel } from '@/lib/plural';
import { Emoji } from '@/ui/Emoji';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { Txt } from '@/ui/Txt';

type Props = {
  journey: JourneyResponse;
  onPress?: () => void;
  /** "lg" and "sm" are fixed-width cards for a sideways rail; "grid" fills half a two-column grid. */
  size?: 'lg' | 'sm' | 'grid';
  /** A label on the photo, such as "3 new". Completed and paused journeys get one by themselves. */
  pill?: string;
  /** An emoji shown before that label. */
  pillEmoji?: string;
  /** The line under the title. By default: where the journey has got to, and whose it is. */
  detail?: string;
  /** A second line, on large cards. By default: how many people follow. */
  footnote?: string;
};

/** A journey as a photo card: cover, title, and where it has got to. */
export function JourneyCard({ journey, onPress, size = 'lg', pill, pillEmoji, detail, footnote }: Props) {
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
      <Photo uri={journey.coverThumbUrl} style={{ height: side ?? 172, marginBottom: 8 }}>
        {label ? <Pill label={label} icon={pill && pillEmoji ? () => <Emoji char={pillEmoji} size={14} /> : undefined} style={{ position: 'absolute', top: 12, left: 12 }} /> : null}
      </Photo>
      <Txt variant={size === 'lg' ? 'item' : 'control'} numberOfLines={2}>
        {journey.title}
      </Txt>
      <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
        {line}
      </Txt>
      {second ? (
        <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
          {second}
        </Txt>
      ) : null}
    </Tap>
  );
}
