import { ArrowDown, Star } from 'lucide-react-native';
import { View } from 'react-native';

import type { JourneySummaryResponse } from '@/api/generated/journey';
import { entryDayLine } from '@/features/entries/labels';
import { formatDay } from '@/lib/dates';
import { plural } from '@/words/en/plural';
import { layout, useTheme } from '@/theme';
import { GroupLabel } from '@/ui/Heading';
import { Tap } from '@/ui/Motion';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

import type { StoryRow } from './rows';

type Props = {
  visible: boolean;
  onClose: () => void;
  summary: JourneySummaryResponse;
  /** What was new when the story was opened, if anything. */
  fresh?: { firstNew: string | null; newCount: number };
  /** The days that are loaded, newest first. */
  days: Extract<StoryRow, { kind: 'day' }>[];
  /** Whether those are all the days of the story, or only the ones around where the reader is. */
  everyDay: boolean;
  /** Goes to an entry; null is the very start of the story. */
  onJump: (entryId: string | null) => void;
};

/**
 * 5.3 Jump to: the ways into a long story in one sheet. Followers continue where they left off, new readers
 * start from the beginning, and every milestone and day is one tap away.
 */
export function JumpSheet({ visible, onClose, summary, fresh, days, everyDay, onJump }: Props) {
  const { colors } = useTheme();
  if (!summary.first) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title="Jump to" tall={days.length > 4}>
      {fresh?.firstNew ? (
        <SheetRow first icon={(c) => <ArrowDown size={22} color={c} />} label="Continue where you left off" note={`${fresh.newCount} new since your last visit`} onPress={() => onJump(fresh.firstNew)} />
      ) : null}
      <SheetRow first={!fresh?.firstNew} label="Start from the beginning" note={entryDayLine(summary.first)} onPress={() => onJump(null)} />
      {summary.latest[0] ? <SheetRow label="Newest entry" note={entryDayLine(summary.latest[0])} onPress={() => onJump(summary.latest[0]?.id ?? null)} /> : null}
      {summary.milestones.length > 0 ? <GroupLabel style={{ marginHorizontal: layout.gutter }}>Milestones</GroupLabel> : null}
      {summary.milestones.map((milestone, index) => (
        <SheetRow
          key={milestone.entryId}
          first={index === 0}
          icon={(c) => <Star size={20} color={c} />}
          label={milestone.title || milestone.label}
          note={`${milestone.label} · ${formatDay(milestone.happenedOn)}`}
          onPress={() => onJump(milestone.entryId)}
        />
      ))}
      {days.length > 1 ? <GroupLabel style={{ marginHorizontal: layout.gutter }}>{everyDay ? 'Days' : 'Days around here'}</GroupLabel> : null}
      {days.length > 1
        ? days.map(({ entry, count }, index) => (
            <Tap
              key={entry.id}
              accessibilityRole="button"
              accessibilityLabel={`${entry.label}${entry.placeName ? `, ${entry.placeName}` : ''}. ${plural(count, 'entry', 'entries')}`}
              scaleTo={0.985}
              onPress={() => onJump(entry.id)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 11, paddingHorizontal: layout.gutter, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
              <Txt variant="control" weight={800} style={{ minWidth: 62 }}>
                {entry.label}
              </Txt>
              <Txt variant="control" weight={600} numberOfLines={1} style={{ flex: 1 }}>
                {entry.placeName ?? formatDay(entry.happenedOn)}
              </Txt>
              <Txt variant="footnote" color="muted">
                {plural(count, 'entry', 'entries')}
              </Txt>
            </Tap>
          ))
        : null}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
