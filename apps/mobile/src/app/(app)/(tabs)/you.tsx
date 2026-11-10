import { useRouter } from 'expo-router';
import { Link as LinkIcon, Lock, Settings as Gear } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type JourneyResponse, useGetMe, useGetMyJourneys, useGetProfile } from '@/api/generated/journey';
import { compact } from '@/lib/plural';
import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Loading, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { JourneyCard } from '@/ui/JourneyCard';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

type Shelf = 'active' | 'completed' | 'private';

/** 9.1 Your profile: your shelf of journeys. Private journeys show here only to you, with a lock. */
export default function You() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const me = useGetMe();
  const mine = useGetMyJourneys();
  const [shelf, setShelf] = useState<Shelf>('active');
  const [pulling, setPulling] = useState(false);
  const reload = async () => {
    setPulling(true);
    await Promise.all([me.refetch(), mine.refetch(), counts.refetch()]);
    setPulling(false);
  };

  const profile = me.data?.profile;
  const counts = useGetProfile(profile?.username ?? '', { query: { enabled: !!profile } });
  if (!profile) return null;

  const journeys = mine.data ?? [];
  const shelves: Record<Shelf, JourneyResponse[]> = {
    active: journeys.filter((j) => j.visibility !== 'private' && j.status !== 'completed'),
    completed: journeys.filter((j) => j.visibility !== 'private' && j.status === 'completed'),
    private: journeys.filter((j) => j.visibility === 'private'),
  };
  const shown = shelves[shelf];
  const openPeople = (tab: 'followers' | 'following') => router.push(`/profile/${profile.username}/people?tab=${tab}` as never);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 8 }}>
          <RoundButton label="Settings" onPress={() => router.push('/settings' as never)} icon={(c) => <Gear size={20} color={c} />} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 22, paddingHorizontal: 18, borderRadius: 26, backgroundColor: colors.surface, boxShadow: shadow.md }}>
          <View style={{ flex: 1.15, alignItems: 'center' }}>
            <Avatar uri={profile.avatarUrl} name={profile.displayName} size={96} />
            <Txt accessibilityRole="header" numberOfLines={2} weight={800} center style={{ fontSize: 23, lineHeight: 27, letterSpacing: -0.7, marginTop: 8 }}>
              {profile.displayName}
            </Txt>
            <Txt color="muted" weight={600} style={{ fontSize: 13, lineHeight: 18 }}>
              @{profile.username}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Stat value={journeys.length} label="Journeys" />
            <Stat value={counts.data?.followerCount ?? 0} label="Followers" divider onPress={() => openPeople('followers')} />
            <Stat value={counts.data?.followingCount ?? 0} label="Following" divider onPress={() => openPeople('following')} />
          </View>
        </View>

        {profile.bio || profile.link ? (
          <View style={{ marginTop: 16, marginHorizontal: 20, gap: 4 }}>
            {profile.bio ? <Txt style={{ fontSize: 14.5, lineHeight: 22 }}>{profile.bio}</Txt> : null}
            {profile.link ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <LinkIcon size={16} color={colors.accentText} />
                <Txt numberOfLines={1} weight={700} style={{ fontSize: 14, lineHeight: 20, color: colors.accentText }}>
                  {profile.link.replace(/^https?:\/\//, '')}
                </Txt>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginHorizontal: 16, marginBottom: 6 }}>
          <Button label="Edit profile" variant="soft" onPress={() => router.push('/edit-profile' as never)} style={{ flex: 1, height: 40 }} />
          <Button label="New journey" variant="soft" onPress={() => router.push('/new' as never)} style={{ flex: 1, height: 40 }} />
        </View>

        <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 24, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line }}>
          <ShelfTab label="Active" count={shelves.active.length} on={shelf === 'active'} onPress={() => setShelf('active')} />
          <ShelfTab label="Completed" count={shelves.completed.length} on={shelf === 'completed'} onPress={() => setShelf('completed')} />
          <ShelfTab label="Private" count={shelves.private.length} on={shelf === 'private'} lock onPress={() => setShelf('private')} />
        </View>

        {mine.isPending ? (
          <View style={{ height: 200 }}>
            <Loading />
          </View>
        ) : mine.isError ? (
          <View style={{ height: 260 }}>
            <Problem error={mine.error} onRetry={() => void mine.refetch()} retrying={mine.isRefetching} />
          </View>
        ) : journeys.length === 0 ? (
          <View style={{ marginTop: 36 }}>
            <EmptyState emoji="🗺️" title="Start your first journey" body="A trip, a 30-day challenge, something you're building. Add to it as it happens." action={<Button label="Start a journey" onPress={() => router.push('/new' as never)} />} />
          </View>
        ) : shown.length === 0 ? (
          <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22, marginTop: 40, marginHorizontal: 40 }}>
            {shelf === 'active' ? 'No active journeys right now.' : shelf === 'completed' ? 'Journeys you complete show up here.' : 'Journeys only you can see show up here.'}
          </Txt>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, marginHorizontal: 10 }}>
            {shown.map((journey) => (
              <View key={journey.id} style={{ width: '50%', paddingHorizontal: 6, marginBottom: 16 }}>
                <JourneyCard
                  journey={journey}
                  size="grid"
                  pill={journey.status === 'active' ? journey.progressLabel : undefined}
                  detail={journey.status === 'active' ? (journey.followerCount > 0 ? `${compact(journey.followerCount)} following` : visibilityNote(journey)) : `${journey.progressLabel} · ${compact(journey.followerCount)} following`}
                  onPress={() => router.push(`/journey/${journey.id}` as never)}
                />
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function visibilityNote(journey: JourneyResponse): string {
  return journey.visibility === 'public' ? 'Public' : journey.visibility === 'unlisted' ? 'Unlisted' : 'Only you';
}

function Stat({ value, label, divider, onPress }: { value: number; label: string; divider?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label}`}
      disabled={!onPress}
      onPress={onPress}
      style={{ paddingVertical: 8, borderTopWidth: divider ? 1 : 0, borderTopColor: colors.line }}>
      <Txt weight={800} style={{ fontSize: 20, lineHeight: 25, letterSpacing: -0.4 }}>
        {compact(value)}
      </Txt>
      <Txt color="muted" weight={700} style={{ fontSize: 11.5, lineHeight: 15 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function ShelfTab({ label, count, on, lock, onPress }: { label: string; count: number; on: boolean; lock?: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const color = on ? colors.text : colors.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={`${label}, ${count}`} accessibilityState={{ selected: on }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 }}>
      {lock ? <Lock size={13} color={color} /> : null}
      <Txt weight={700} style={{ fontSize: 15, lineHeight: 20, color }}>
        {label}
      </Txt>
      <Txt weight={600} style={{ fontSize: 12.5, lineHeight: 17, color }}>
        {count}
      </Txt>
      {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2, backgroundColor: colors.text }} /> : null}
    </Pressable>
  );
}
