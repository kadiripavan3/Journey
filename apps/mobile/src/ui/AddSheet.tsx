import { useRouter } from 'expo-router';
import { ChevronRight, Plus, Route } from 'lucide-react-native';
import { View } from 'react-native';

import { useGetMyJourneys } from '@/api/generated/journey';
import { timeAgo } from '@/lib/dates';
import { useTheme } from '@/theme';

import { Loading, Photo, Problem } from './Bits';
import { Button } from './Button';
import { Sheet, SheetRow } from './Sheet';
import { Txt } from './Txt';

/** 7.1 The + button: your journeys first, so today's entry is two taps away; a new journey is one row below. */
export function AddSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const mine = useGetMyJourneys({ query: { enabled: visible } });
  const open = (mine.data ?? []).filter((journey) => journey.viewer.canAddEntry);

  const go = (href: string) => {
    onClose();
    router.push(href as never);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={open.length > 0 ? 'Add to a journey' : 'Start your first journey'}>
      {mine.isPending ? (
        <View style={{ height: 120 }}>
          <Loading />
        </View>
      ) : mine.isError ? (
        <View style={{ height: 220 }}>
          <Problem error={mine.error} onRetry={() => void mine.refetch()} retrying={mine.isRefetching} />
        </View>
      ) : (
        <>
          {open.length === 0 ? (
            <Txt color="muted" style={{ fontSize: 14, lineHeight: 20, paddingHorizontal: 22, paddingBottom: 10 }}>
              Every entry belongs to a journey: a trip, a challenge, anything with a story.
            </Txt>
          ) : null}
          {open.map((journey, index) => (
            <View
              key={journey.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 16, marginTop: 4, marginBottom: 8, padding: 10, borderRadius: 20, backgroundColor: colors.fill }}>
              <Photo uri={journey.coverUrl} radius={14} style={{ width: 56, height: 56, backgroundColor: colors.fill2 }} />
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={1} weight={800} style={{ fontSize: 15, lineHeight: 20 }}>
                  {journey.title}
                </Txt>
                <Txt numberOfLines={1} color="muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
                  {journey.progressLabel}
                  {journey.status === 'paused' ? ' · paused' : journey.lastEntryAt ? ` · last entry ${timeAgo(journey.lastEntryAt)}` : ''}
                </Txt>
              </View>
              <Button
                label="Entry"
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
            label="Start a new journey"
            note="A trip, a challenge, anything with a story"
            trailing={<ChevronRight size={18} color={colors.muted} />}
            onPress={() => go('/new')}
          />
        </>
      )}
    </Sheet>
  );
}
