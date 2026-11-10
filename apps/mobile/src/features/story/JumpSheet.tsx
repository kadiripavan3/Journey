import { ArrowDown, Star } from 'lucide-react-native';
import { View } from 'react-native';

import { type JourneySummaryResponse, useGetStoryDaysInfinite } from '@/api/generated/journey';
import { paged, rows } from '@/api/pages';
import { entryDayLine } from '@/features/entries/labels';
import { formatDay } from '@/lib/dates';
import { layout, radius, useTheme } from '@/theme';
import { GroupLabel } from '@/ui/Heading';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Rail } from '@/ui/Rail';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

type Props = {
  visible: boolean;
  onClose: () => void;
  journeyId: string;
  summary: JourneySummaryResponse;
  /** What was new when the story was opened, if anything. */
  fresh?: { firstNew: string | null; newCount: number };
  /** Goes to an entry; null is the very start of the story. */
  onJump: (entryId: string | null) => void;
};

/** How big a highlight's picture is. */
const HIGHLIGHT = 78;

/**
 * 5.3 Jump to: the ways into a long story in one sheet. Followers continue where they left off, new readers
 * start from the beginning, and every highlight and every day is one tap away. The days are asked for when
 * the sheet opens, a page at a time, so the list is whole however much of the story is loaded.
 */
export function JumpSheet({ visible, onClose, journeyId, summary, fresh, onJump }: Props) {
  const { colors } = useTheme();
  const days = useGetStoryDaysInfinite(journeyId, undefined, { query: { ...paged, enabled: visible } });
  const list = rows(days.data) ?? [];
  if (!summary.first) return null;
  return (
    <Sheet visible={visible} onClose={onClose} title={words.story.jump.title} tall={list.length > 4 || summary.milestones.length > 0}>
      {fresh?.firstNew ? (
        <SheetRow first icon={(c) => <ArrowDown size={22} color={c} />} label={words.story.jump.resume} note={words.story.newSinceVisit(fresh.newCount)} onPress={() => onJump(fresh.firstNew)} />
      ) : null}
      <SheetRow first={!fresh?.firstNew} label={words.story.jump.start} note={entryDayLine(summary.first)} onPress={() => onJump(null)} />
      {summary.latest[0] ? <SheetRow label={words.story.jump.newest} note={entryDayLine(summary.latest[0])} onPress={() => onJump(summary.latest[0]?.id ?? null)} /> : null}
      {summary.milestones.length > 0 ? <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.story.jump.highlights}</GroupLabel> : null}
      {summary.milestones.length > 0 ? (
        <Rail>
          {summary.milestones.map((milestone) => (
            <Tap
              key={milestone.entryId}
              accessibilityRole="button"
              accessibilityLabel={words.story.jump.highlightSpoken(milestone.label, milestone.title)}
              scaleTo={0.97}
              onPress={() => onJump(milestone.entryId)}
              style={{ width: HIGHLIGHT }}>
              <Photo uri={milestone.thumbUrl} radius="field" style={{ width: HIGHLIGHT, height: HIGHLIGHT }}>
                <View style={{ position: 'absolute', left: 6, top: 6, width: 22, height: 22, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent }}>
                  <Star size={12} color={colors.onAccent} fill={colors.onAccent} />
                </View>
              </Photo>
              <Txt variant="footnote" weight={800} numberOfLines={1} style={{ marginTop: 6 }}>
                {milestone.label}
              </Txt>
              <Txt variant="tiny" color="muted" numberOfLines={1}>
                {milestone.title || formatDay(milestone.happenedOn)}
              </Txt>
            </Tap>
          ))}
        </Rail>
      ) : null}
      {list.length > 1 ? <GroupLabel style={{ marginHorizontal: layout.gutter }}>{words.story.jump.days}</GroupLabel> : null}
      {list.length > 1
        ? list.map((day, index) => {
            const label = day.label ?? formatDay(day.happenedOn);
            return (
              <Tap
                key={day.happenedOn}
                accessibilityRole="button"
                accessibilityLabel={words.story.jump.daySpoken(label, day.place, day.entryCount)}
                scaleTo={0.985}
                onPress={() => onJump(day.firstEntryId)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 11, paddingHorizontal: layout.gutter, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
                <Txt variant="control" weight={800} style={{ minWidth: 62 }}>
                  {label}
                </Txt>
                <Txt variant="control" weight={600} numberOfLines={1} style={{ flex: 1 }}>
                  {day.place ?? (day.label ? formatDay(day.happenedOn) : '')}
                </Txt>
                <Txt variant="footnote" color="muted">
                  {words.story.jump.entries(day.entryCount)}
                </Txt>
              </Tap>
            );
          })
        : null}
      {days.hasNextPage ? <SheetRow label={words.story.jump.earlier} onPress={() => void days.fetchNextPage()} /> : null}
      <View style={{ height: 8 }} />
    </Sheet>
  );
}
