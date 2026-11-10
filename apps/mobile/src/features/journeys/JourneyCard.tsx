import { Users } from 'lucide-react-native';
import { View } from 'react-native';

import type { JourneyResponse } from '@/api/generated/journey';
import { followersLabel } from '@/lib/following';
import { Emoji } from '@/ui/Emoji';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { ProgressBar } from '@/ui/ProgressBar';
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
  /** How far along it is, from 0 to 1: a thin bar under the title, for a challenge among challenges. */
  progress?: number;
};

/** A journey as a photo card: cover, title, and where it has got to. A journey that friends write together says "Shared", next to any other label. */
export function JourneyCard({ journey, onPress, size = 'lg', pill, pillEmoji, detail, footnote, progress }: Props) {
  const side = size === 'lg' ? 232 : size === 'sm' ? 158 : undefined;
  const label = pill ?? (journey.status === 'completed' ? 'Completed' : journey.status === 'paused' ? 'Paused' : null);
  const shared = journey.authors.length > 1;
  const line = detail ?? `${journey.progressLabel} · ${journey.owner.displayName}`;
  const second = size === 'lg' ? (footnote ?? followersLabel(journey.followerCount)) : null;
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${journey.title}. ${line}.${label ? ` ${label}.` : ''}${shared ? ' Shared.' : ''}`}
      onPress={onPress}
      style={{ width: side, flex: side ? undefined : 1, gap: 2 }}>
      <Photo uri={journey.coverThumbUrl} style={{ height: side ?? 172, marginBottom: 8 }}>
        {label || shared ? (
          <View style={{ position: 'absolute', top: 12, left: 12, right: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {label ? <Pill label={label} icon={pill && pillEmoji ? () => <Emoji char={pillEmoji} size={14} /> : undefined} /> : null}
            {shared ? <Pill label="Shared" icon={(c) => <Users size={13} color={c} />} /> : null}
          </View>
        ) : null}
      </Photo>
      <Txt variant={size === 'lg' ? 'item' : 'control'} numberOfLines={2}>
        {journey.title}
      </Txt>
      {progress === undefined ? null : (
        <View style={{ marginVertical: 4 }}>
          <ProgressBar fraction={progress} />
        </View>
      )}
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
