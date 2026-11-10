import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ActivityItemResponse, useGetActivity, useGetDigest, useMarkActivitySeen } from '@/api/generated/journey';
import { useRefetchOnFocus } from '@/api/refetchOnFocus';
import { timeAgo } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Loading, Photo, Problem } from '@/ui/Bits';
import { Emoji } from '@/ui/Emoji';
import { EmptyState } from '@/ui/EmptyState';
import { GroupLabel } from '@/ui/Heading';
import { Rise } from '@/ui/Motion';
import { PersonFollowButton } from '@/ui/PersonFollowButton';
import { Txt } from '@/ui/Txt';

const FILTERS = [
  { id: 'all', label: 'All', kinds: null },
  { id: 'journeys', label: 'Journeys', kinds: ['new_entries', 'journey_completed'] },
  { id: 'comments', label: 'Comments', kinds: ['comment', 'reply', 'likes'] },
  { id: 'followers', label: 'People', kinds: ['journey_follow', 'profile_follow', 'invitation', 'friend_joined'] },
] as const;

/** 8.1 Activity: one calm inbox. New entries are grouped per journey and likes are batched into a single line. */
export default function Activity() {
  const { colors } = useTheme();
  const activity = useGetActivity();
  const markSeen = useMarkActivitySeen();
  const week = useGetDigest().data;
  const router = useRouter();
  useRefetchOnFocus(activity.refetch);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('all');
  const [pulling, setPulling] = useState(false);
  // What was new when the tab was opened stays highlighted while it is on screen.
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const newCount = activity.data?.newCount ?? 0;
  const items = activity.data?.items;
  const { mutate: seen } = markSeen;
  useFocusEffect(
    useCallback(() => {
      if (newCount > 0 && items) {
        setFresh((now) => new Set([...now, ...items.filter((item) => item.isNew).map((item) => item.id)]));
        seen(undefined, { onSuccess: () => void activity.refetch() });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the tab gains focus or new lines arrive
    }, [newCount, seen]),
  );

  const kinds = FILTERS.find((f) => f.id === filter)?.kinds;
  const shown = (items ?? []).filter((item) => !kinds || (kinds as readonly string[]).includes(item.kind));
  const isFresh = (item: ActivityItemResponse) => item.isNew || fresh.has(item.id);
  const recent = shown.filter(isFresh);
  const earlier = shown.filter((item) => !isFresh(item));
  const reload = async () => {
    setPulling(true);
    await activity.refetch();
    setPulling(false);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <Txt accessibilityRole="header" weight={800} style={{ fontSize: 31, lineHeight: 36, letterSpacing: -1.2, marginTop: 10, marginHorizontal: 20 }}>
        Activity
      </Txt>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 24, marginTop: 6, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        {FILTERS.map((f) => {
          const on = f.id === filter;
          return (
            <Pressable key={f.id} accessibilityRole="tab" accessibilityLabel={f.label} accessibilityState={{ selected: on }} onPress={() => setFilter(f.id)} style={{ paddingVertical: 12 }}>
              <Txt weight={700} style={{ fontSize: 15, lineHeight: 20, color: on ? colors.text : colors.muted }}>
                {f.label}
              </Txt>
              {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2, backgroundColor: colors.text }} /> : null}
            </Pressable>
          );
        })}
      </View>

      {activity.isPending ? (
        <Loading />
      ) : activity.isError ? (
        <Problem error={activity.error} onRetry={() => void activity.refetch()} retrying={activity.isRefetching} />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 130, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
          {week && week.entryCount > 0 && filter === 'all' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`This week: ${plural(week.entryCount, 'new entry', 'new entries')} in ${plural(week.journeys.length, 'journey')}. Open the weekly digest.`}
              onPress={() => router.push('/digest' as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, marginHorizontal: 16, padding: 14, borderRadius: 20, backgroundColor: colors.fill }}>
              <Emoji char="🗞️" size={34} />
              <View style={{ flex: 1 }}>
                <Txt weight={800} style={{ fontSize: 15, lineHeight: 20 }}>
                  This week in the journeys you follow
                </Txt>
                <Txt color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
                  {plural(week.entryCount, 'new entry', 'new entries')} in {plural(week.journeys.length, 'journey')}
                </Txt>
              </View>
            </Pressable>
          ) : null}
          {shown.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 40 }}>
              <EmptyState
                emoji="🔔"
                title={filter === 'all' ? 'Nothing new yet' : 'Nothing here yet'}
                body="New entries from journeys you follow, and likes, comments and followers on yours, arrive here."
              />
            </View>
          ) : (
            <>
              {recent.length > 0 ? <GroupLabel style={{ marginHorizontal: 22 }}>New</GroupLabel> : null}
              {recent.map((item, index) => (
                <Rise key={item.id} index={index}>
                  <Line item={item} fresh />
                </Rise>
              ))}
              {earlier.length > 0 ? <GroupLabel style={{ marginHorizontal: 22 }}>{recent.length > 0 ? 'Earlier' : 'This month'}</GroupLabel> : null}
              {earlier.map((item, index) => (
                <Rise key={item.id} index={index}>
                  <Line item={item} />
                </Rise>
              ))}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/** One line of Activity: who, what, when, and the picture it is about. */
function Line({ item, fresh }: { item: ActivityItemResponse; fresh?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [first, second] = item.actors;
  if (!first) return null;

  const bold = (text: string | null) => (
    <Txt weight={800} style={{ fontSize: 14, lineHeight: 20 }}>
      {text}
    </Txt>
  );
  const who =
    item.actorCount <= 1 || !second ? (
      bold(first.displayName)
    ) : item.actorCount === 2 ? (
      <>
        {bold(first.displayName)} and {bold(second.displayName)}
      </>
    ) : (
      <>
        {bold(`${first.displayName}, ${second.displayName}`)} and {item.actorCount - 2} {item.actorCount === 3 ? 'other' : 'others'}
      </>
    );

  let what: React.ReactNode;
  let href: string;
  switch (item.kind) {
    case 'new_entries':
      what = (
        <>
          {' '}
          added {item.count === 1 ? 'an entry' : `${item.count} entries`} to {bold(item.journeyTitle)}
        </>
      );
      href = `/journey/${item.journeyId}/timeline`;
      break;
    case 'journey_completed':
      what = <> completed {bold(item.journeyTitle)} 🎉</>;
      href = `/journey/${item.journeyId}`;
      break;
    case 'likes':
      what = <> liked {bold(item.entryTitle)}</>;
      href = `/entry/${item.entryId}`;
      break;
    case 'comment':
      what = <> commented: “{item.text}”</>;
      href = `/entry/${item.entryId}?comments=1`;
      break;
    case 'reply':
      what = <> replied to your comment: “{item.text}”</>;
      href = `/entry/${item.entryId}?comments=1`;
      break;
    case 'invitation':
      what = <> invited you to add to {bold(item.journeyTitle)}</>;
      href = `/invitation/${item.journeyId}`;
      break;
    case 'friend_joined':
      what = <> joined {bold(item.journeyTitle)}</>;
      href = `/journey/${item.journeyId}`;
      break;
    case 'journey_follow':
      what = <> started following {bold(item.journeyTitle)}</>;
      href = `/profile/${first.username}`;
      break;
    default:
      what = <> started following you</>;
      href = `/profile/${first.username}`;
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11, paddingHorizontal: 20, backgroundColor: fresh ? colors.accentSoft : 'transparent' }}>
      <Pressable accessibilityRole="button" onPress={() => router.push(href as never)} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12, opacity: pressed ? 0.8 : 1 })}>
        {second && item.actorCount > 1 ? (
          <View style={{ width: 44, height: 44 }}>
            <View style={{ position: 'absolute', left: 0, top: 0 }}>
              <Avatar uri={first.avatarUrl} name={first.displayName} size={30} />
            </View>
            <View style={{ position: 'absolute', right: 0, bottom: 0, borderRadius: 17, borderWidth: 2, borderColor: fresh ? colors.accentSoft : colors.bg }}>
              <Avatar uri={second.avatarUrl} name={second.displayName} size={28} />
            </View>
          </View>
        ) : (
          <Avatar uri={first.avatarUrl} name={first.displayName} size={44} />
        )}
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={4} style={{ fontSize: 14, lineHeight: 20 }}>
            {who}
            {what}
          </Txt>
          <Txt color="muted" style={{ fontSize: 12.5, lineHeight: 17, marginTop: 3 }}>
            {timeAgo(item.at)}
          </Txt>
        </View>
        {item.thumbUrl ? <Photo uri={item.thumbUrl} radius={12} style={{ width: 48, height: 48 }} /> : null}
      </Pressable>
      {item.kind === 'profile_follow' && !item.followsActor ? <PersonFollowButton username={first.username} isFollowing={false} followsYou /> : null}
    </View>
  );
}
