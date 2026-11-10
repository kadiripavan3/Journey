import { type Href, useRouter } from 'expo-router';
import { ChevronRight, CloudUpload, Plus, Route } from 'lucide-react-native';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useOutbox } from '@/features/drafts/outbox';
import { useMyJourneys } from '@/features/journeys/useMyJourneys';
import { timeAgo } from '@/lib/dates';
import { layout, radius, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Loading } from '@/ui/Loading';
import { Photo } from '@/ui/Photo';
import { Problem } from '@/ui/Problem';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** 7.1 The + button: your journeys first, so today's entry is two taps away; a new journey is one row below. */
export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const mine = useMyJourneys(visible);
  const open = mine.journeys.filter((journey) => journey.viewer.canAddEntry);
  // Entries that are still on this phone: drafts, and ones on their way up.
  const waiting = useOutbox().drafts;
  const drafts = waiting.filter((draft) => draft.state === 'draft').length;
  const waitingLine = words.common.join([waiting.length - drafts > 0 ? words.journeys.add.waitingToUpload(waiting.length - drafts) : null, drafts > 0 ? words.journeys.add.draftCount(drafts) : null]);

  const go = (href: Href) => {
    onClose();
    router.push(href);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={open.length > 0 ? words.journeys.add.title : words.journeys.add.titleFirst}>
      {mine.isPending ? (
        <View style={{ height: 120 }}>
          <Loading offline={mine.isPaused} />
        </View>
      ) : mine.isError && !mine.data ? (
        <View style={{ height: 220 }}>
          <Problem message={messageFor(mine.error)} onRetry={() => void mine.refetch()} retrying={mine.isFetching} />
        </View>
      ) : (
        <>
          {open.length === 0 ? (
            <Txt variant="callout" color="muted" style={{ paddingHorizontal: layout.gutter, paddingBottom: 10 }}>
              {words.journeys.add.lead}
            </Txt>
          ) : null}
          {open.map((journey, index) => (
            <View
              key={journey.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: layout.barGutter, marginTop: 4, marginBottom: 8, padding: 10, borderRadius: radius.card, backgroundColor: colors.fill }}>
              <Photo uri={journey.coverThumbUrl} radius="thumb" style={{ width: 56, height: 56, backgroundColor: colors.fill2 }} />
              <View style={{ flex: 1 }}>
                <Txt variant="item" numberOfLines={1} weight={800}>
                  {journey.title}
                </Txt>
                <Txt variant="footnote" numberOfLines={1} color="muted">
                  {words.common.join([journey.progressLabel, journey.status === 'paused' ? words.journeys.add.paused : journey.lastEntryAt ? words.journeys.add.lastEntry(timeAgo(journey.lastEntryAt)) : null])}
                </Txt>
              </View>
              <Button
                label={words.journeys.add.entry}
                inline
                size="sm"
                variant={index === 0 ? 'primary' : 'soft'}
                icon={(c) => <Plus size={16} color={c} strokeWidth={2.6} />}
                onPress={() => go(`/journey/${journey.id}/add`)}
              />
            </View>
          ))}
          <SheetRow
            first
            icon={(c) => <Route size={22} color={c} />}
            label={words.journeys.add.startNew}
            note={words.journeys.add.startNewNote}
            trailing={<ChevronRight size={18} color={colors.muted} />}
            onPress={() => go('/new')}
          />
          {waiting.length > 0 ? (
            <SheetRow
              icon={(c) => <CloudUpload size={22} color={c} />}
              label={words.journeys.add.drafts}
              note={waitingLine}
              trailing={<ChevronRight size={18} color={colors.muted} />}
              onPress={() => go('/uploads')}
            />
          ) : null}
        </>
      )}
    </Sheet>
  );
}
