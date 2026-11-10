import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, BookOpen, Ellipsis, Pause, Play, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, useDeleteJourney, useGetJourney, useGetTimeline, useUpdateJourney } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { useCatalog } from '@/journey/catalog';
import { compact, plural } from '@/lib/plural';
import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Loading, Photo, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { EntryRow } from '@/ui/EntryBits';
import { FollowButton } from '@/ui/FollowButton';
import { GlassBar } from '@/ui/GlassBar';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

const STATUS = { active: 'Active', paused: 'Paused', completed: 'Completed' } as const;

/** 5.1 Journey: photo first, the creator's face on the sheet, honest stats, highlights, and one strong Follow button that floats. */
export default function JourneyPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const journey = useGetJourney(id);
  const timeline = useGetTimeline(id);
  const [menu, setMenu] = useState(false);

  if (journey.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading />
      </View>
    );
  }
  if (journey.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <RoundButton label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
        <Problem error={journey.error} onRetry={() => void journey.refetch()} retrying={journey.isRefetching} />
      </View>
    );
  }

  const j = journey.data;
  const entries = timeline.data ?? [];
  const photos = entries.flatMap((entry) => entry.media.filter((m) => m.kind === 'photo').map((m) => m.url));
  const latest = [...entries].reverse().slice(0, 3);
  const firstName = j.owner.displayName.trim().split(/\s+/)[0];
  const category = catalog.category(j.category);
  const openStory = () => router.push(`/journey/${j.id}/timeline` as never);
  const openOwner = () => router.push(`/profile/${j.owner.username}` as never);
  const statusColor = j.status === 'active' ? colors.ok : j.status === 'completed' ? colors.done : colors.warn;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Photo uri={j.coverUrl} radius={0} style={{ height: 338, backgroundColor: colors.fill2 }} label={`Cover photo of ${j.title}`}>
          <LinearGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }} />
        </Photo>
        <View style={{ marginTop: -30, paddingTop: 52, paddingHorizontal: 22, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.bg, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${j.owner.displayName}'s profile`}
            onPress={openOwner}
            style={{ position: 'absolute', top: -38, borderRadius: 42, borderWidth: 4, borderColor: colors.bg, boxShadow: '0 6px 16px rgba(0, 0, 0, 0.16)' }}>
            <Avatar uri={j.owner.avatarUrl} name={j.owner.displayName} size={76} />
          </Pressable>
          <Txt accessibilityRole="header" weight={800} center style={{ fontSize: 27, lineHeight: 30, letterSpacing: -0.95 }}>
            {j.title}
          </Txt>
          {j.description ? (
            <Txt color="muted" center style={{ fontSize: 15, lineHeight: 22, marginTop: 10, maxWidth: 320 }}>
              {j.description}
            </Txt>
          ) : null}
          <Txt center weight={700} onPress={openOwner} style={{ fontSize: 13, lineHeight: 18, marginTop: 10 }}>
            {j.owner.displayName}
            {category ? <Txt color="muted" weight={500} style={{ fontSize: 13, lineHeight: 18 }}>{` · ${category.label}`}</Txt> : null}
          </Txt>

          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 18, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
            <Stat value={j.progressLabel} label={STATUS[j.status]} dot={statusColor} />
            <Stat value={String(j.entryCount)} label={j.entryCount === 1 ? 'entry' : 'entries'} divider />
            <Stat value={compact(j.followerCount)} label="following" divider />
          </View>

          {photos.length >= 3 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${plural(photos.length, 'photo')}. Open the story.`} onPress={openStory} style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 6, height: 206, marginTop: 18, borderRadius: 20, overflow: 'hidden' }}>
              <Photo uri={photos[0]} radius={0} style={{ flex: 1.25 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Photo uri={photos[1]} radius={0} style={{ flex: 1 }} />
                <Photo uri={photos[2]} radius={0} style={{ flex: 1 }}>
                  {photos.length > 3 ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.42)' }}>
                      <Txt weight={800} style={{ fontSize: 18, lineHeight: 23, color: colors.onPhoto }}>
                        +{photos.length - 3}
                      </Txt>
                    </View>
                  ) : null}
                </Photo>
              </View>
            </Pressable>
          ) : null}

          <View style={{ alignSelf: 'stretch', gap: 18, marginTop: 18 }}>
            {timeline.isPending ? (
              <View style={{ height: 120 }}>
                <Loading />
              </View>
            ) : timeline.isError ? (
              <Txt color="muted" center>
                {messageFor(timeline.error)}
              </Txt>
            ) : entries.length === 0 ? (
              <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22, marginVertical: 20 }}>
                {j.viewer.isOwner ? 'Your story starts with the first entry.' : `${firstName} hasn't added an entry yet. Follow to hear about the first one.`}
              </Txt>
            ) : (
              <>
                {latest.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onPress={() => router.push(`/entry/${entry.id}` as never)} />
                ))}
                <Button label={entries.length > 3 ? `Read all ${entries.length} entries` : 'Read the story'} variant="line" block icon={(c) => <BookOpen size={18} color={c} />} onPress={openStory} />
              </>
            )}
          </View>
          {j.status === 'completed' && j.closingNote ? (
            <View style={{ alignSelf: 'stretch', marginTop: 18, padding: 16, borderRadius: 18, backgroundColor: colors.fill }}>
              <Txt variant="label" color="muted">
                Closing note
              </Txt>
              <Txt style={{ fontSize: 14.5, lineHeight: 22, marginTop: 6 }}>{j.closingNote}</Txt>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <RoundButton tone="photo" label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        {j.viewer.isOwner ? <RoundButton tone="photo" label="Journey options" onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} /> : null}
      </View>

      <GlassBar
        radius={30}
        style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12) + 8 }}
        contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 20, paddingRight: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1} weight={800} style={{ fontSize: 15, lineHeight: 20, letterSpacing: -0.2 }}>
            {j.viewer.isOwner ? 'Your journey' : j.viewer.isFollowing ? `You follow ${firstName}'s journey` : `Follow ${firstName}'s journey`}
          </Txt>
          <Txt numberOfLines={1} color="muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
            {j.viewer.isOwner
              ? j.status === 'completed'
                ? 'Completed'
                : j.status === 'paused'
                  ? 'Paused. A new entry starts it again.'
                  : j.entryCount === 0
                    ? 'Add the first entry'
                    : `${plural(j.entryCount, 'entry', 'entries')} so far`
              : j.status === 'completed'
                ? 'This journey is completed'
                : 'New entries land on your Home'}
          </Txt>
        </View>
        {j.viewer.isOwner ? (
          j.viewer.canAddEntry ? (
            <Button label="Entry" inline icon={(c) => <Plus size={19} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add` as never)} />
          ) : null
        ) : (
          <FollowButton journey={j} size="md" />
        )}
      </GlassBar>

      {j.viewer.isOwner ? <OwnerMenu journey={j} visible={menu} onClose={() => setMenu(false)} /> : null}
    </View>
  );
}

function Stat({ value, label, dot, divider }: { value: string; label: string; dot?: string; divider?: boolean }) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={`${value}, ${label}`} style={{ flex: 1, alignItems: 'center', borderLeftWidth: divider ? 1 : 0, borderLeftColor: colors.line, paddingHorizontal: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        {dot ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} /> : null}
        <Txt numberOfLines={1} weight={800} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.35 }}>
          {value}
        </Txt>
      </View>
      <Txt color="muted" weight={600} style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </Txt>
    </View>
  );
}

/** What the owner can do with a journey: pause it, start it again, or delete it (after confirming). */
function OwnerMenu({ journey, visible, onClose }: { journey: JourneyResponse; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const refresh = useRefreshAll();
  const [confirming, setConfirming] = useState(false);
  const update = useUpdateJourney({ mutation: { onSuccess: async () => { await refresh(); close(); } } });
  const remove = useDeleteJourney({
    mutation: {
      onSuccess: async () => {
        close();
        router.dismissAll();
        await refresh();
      },
    },
  });
  const close = () => {
    setConfirming(false);
    onClose();
  };
  const failed = update.error ?? remove.error;

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={confirming ? 'Delete this journey?' : journey.title}
      subtitle={confirming ? `"${journey.title}" and its ${plural(journey.entryCount, 'entry', 'entries')} will be gone for good, for you and everyone following.` : undefined}>
      {failed ? (
        <Txt variant="caption" color="danger" style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          {messageFor(failed)}
        </Txt>
      ) : null}
      {confirming ? (
        <View style={{ gap: 10, paddingHorizontal: 20, paddingTop: 6 }}>
          <Button label="Delete journey" variant="danger" size="lg" block loading={remove.isPending} onPress={() => remove.mutate({ id: journey.id })} />
          <Button label="Keep it" variant="soft" size="lg" block onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <>
          {journey.status === 'active' ? (
            <SheetRow first icon={(c) => <Pause size={22} color={c} />} label="Pause journey" note="Followers see it's on hold. A new entry starts it again." onPress={() => update.mutate({ id: journey.id, data: { status: 'paused' } })} />
          ) : journey.status === 'paused' ? (
            <SheetRow first icon={(c) => <Play size={22} color={c} />} label="Resume journey" onPress={() => update.mutate({ id: journey.id, data: { status: 'active' } })} />
          ) : null}
          <SheetRow first={journey.status === 'completed'} danger icon={(c) => <Trash2 size={22} color={c} />} label="Delete journey" onPress={() => setConfirming(true)} />
        </>
      )}
    </Sheet>
  );
}
