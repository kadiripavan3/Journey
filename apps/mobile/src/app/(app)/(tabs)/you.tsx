import { useRouter } from 'expo-router';
import { Link as LinkIcon, Lock, Settings as Gear } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, useGetMe, useGetProfile } from '@/api/generated/journey';
import { JourneyCard } from '@/features/journeys/JourneyCard';
import { useMyJourneys } from '@/features/journeys/useMyJourneys';
import { visibility } from '@/features/journeys/visibility';
import { compact } from '@/lib/plural';
import { layout, radius, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Stat } from '@/ui/Stat';
import { Txt } from '@/ui/Txt';
import { WordTabs } from '@/ui/WordTabs';

type Shelf = 'active' | 'completed' | 'private';

/** 9.1 Your profile: your shelf of journeys. Private journeys show here only to you, with a lock. */
export default function You() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const me = useGetMe();
  const mine = useMyJourneys();
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

  const journeys = mine.journeys;
  const shelves: Record<Shelf, JourneyResponse[]> = {
    active: journeys.filter((j) => j.visibility !== 'private' && j.status !== 'completed'),
    completed: journeys.filter((j) => j.visibility !== 'private' && j.status === 'completed'),
    private: journeys.filter((j) => j.visibility === 'private'),
  };
  const shown = shelves[shelf];
  const openPeople = (tab: 'followers' | 'following') => router.push(`/profile/${profile.username}/people?tab=${tab}`);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 4, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={pulling} onRefresh={() => void reload()} tintColor={colors.muted} />}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: layout.barGutter, paddingBottom: 8 }}>
          <RoundButton label="Settings" onPress={() => router.push('/settings')} icon={(c) => <Gear size={20} color={c} />} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, paddingVertical: 22, paddingHorizontal: 18, borderRadius: radius.panel, backgroundColor: colors.surface, boxShadow: shadow.md }}>
          <View style={{ flex: 1.15, alignItems: 'center' }}>
            <Avatar uri={profile.avatarUrl} name={profile.displayName} size={96} />
            <Txt variant="title" accessibilityRole="header" numberOfLines={2} center style={{ marginTop: 8 }}>
              {profile.displayName}
            </Txt>
            <Txt variant="caption" color="muted">
              @{profile.username}
            </Txt>
          </View>
          <View style={{ flex: 1 }}>
            <Stat layout="stack" size="titleSmall" value={compact(journeys.length)} spoken={journeys.length} label="Journeys" />
            <Stat layout="stack" size="titleSmall" value={compact(counts.data?.followerCount ?? 0)} spoken={counts.data?.followerCount ?? 0} label="Followers" divider onPress={() => openPeople('followers')} />
            <Stat layout="stack" size="titleSmall" value={compact(counts.data?.followingCount ?? 0)} spoken={counts.data?.followingCount ?? 0} label="Following" divider onPress={() => openPeople('following')} />
          </View>
        </View>

        {profile.bio || profile.link ? (
          <View style={{ marginTop: 16, marginHorizontal: layout.rowGutter, gap: 4 }}>
            {profile.bio ? <Txt variant="bodySmall">{profile.bio}</Txt> : null}
            {profile.link ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <LinkIcon size={16} color={colors.accentText} />
                <Txt variant="callout" numberOfLines={1} weight={700} style={{ color: colors.accentText }}>
                  {profile.link.replace(/^https?:\/\//, '')}
                </Txt>
              </View>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginHorizontal: layout.barGutter, marginBottom: 6 }}>
          <Button label="Edit profile" variant="soft" onPress={() => router.push('/edit-profile')} style={{ flex: 1, height: 40 }} />
          <Button label="New journey" variant="soft" onPress={() => router.push('/new')} style={{ flex: 1, height: 40 }} />
        </View>

        <WordTabs
          tabs={[
            { id: 'active', label: 'Active', count: shelves.active.length },
            { id: 'completed', label: 'Completed', count: shelves.completed.length },
            { id: 'private', label: 'Private', count: shelves.private.length, icon: (c) => <Lock size={13} color={c} /> },
          ]}
          value={shelf}
          onChange={setShelf}
        />

        {mine.isPending ? (
          <View style={{ height: 200 }}>
            <Loading />
          </View>
        ) : mine.isError ? (
          <View style={{ height: 260 }}>
            <Problem message={messageFor(mine.error)} onRetry={() => void mine.refetch()} retrying={mine.isRefetching} />
          </View>
        ) : journeys.length === 0 ? (
          <View style={{ marginTop: 36 }}>
            <EmptyState emoji="🗺️" title="Start your first journey" body="A trip, a 30-day challenge, something you're building. Add to it as it happens." action={<Button label="Start a journey" onPress={() => router.push('/new')} />} />
          </View>
        ) : shown.length === 0 ? (
          <Txt variant="bodySmall" color="muted" center style={{ marginTop: 40, marginHorizontal: 40 }}>
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
                  detail={journey.status === 'active' ? (journey.followerCount > 0 ? `${compact(journey.followerCount)} following` : visibility(journey.visibility).badge) : `${journey.progressLabel} · ${compact(journey.followerCount)} following`}
                  onPress={() => router.push(`/journey/${journey.id}`)}
                />
              </View>
            ))}
          </View>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}
