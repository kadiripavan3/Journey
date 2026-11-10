import { useRouter } from 'expo-router';
import { Lock, Settings as Gear, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, useGetMe, useGetProfile } from '@/api/generated/journey';
import { OutboxLink } from '@/features/drafts/PostingBanner';
import { JourneyCard } from '@/features/journeys/JourneyCard';
import { useMyJourneys } from '@/features/journeys/useMyJourneys';
import { ProfileShareSheet } from '@/features/sharing/ShareSheet';
import { visibility } from '@/features/journeys/visibility';
import { ProfileLink } from '@/features/people/ProfileLink';
import { compact } from '@/lib/compact';
import { audienceLabel } from '@/lib/following';
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
import { words } from '@/words';

type Shelf = 'active' | 'completed' | 'private';

/** 9.1 Your profile: your shelf of journeys. Private journeys show here only to you, with a lock. */
export default function You() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const me = useGetMe();
  const mine = useMyJourneys();
  const [shelf, setShelf] = useState<Shelf>('active');
  const [pulling, setPulling] = useState(false);
  const [sharing, setSharing] = useState(false);
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
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: layout.barGutter, paddingBottom: 8 }}>
          <RoundButton label={words.profile.you.share} onPress={() => setSharing(true)} icon={(c) => <Share2 size={19} color={c} />} />
          <RoundButton label={words.settings.title} onPress={() => router.push('/settings')} icon={(c) => <Gear size={20} color={c} />} />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: layout.barGutter, paddingVertical: 22, paddingHorizontal: 18, borderRadius: radius.panel, backgroundColor: colors.surface, boxShadow: shadow.md }}>
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
            <Stat layout="stack" size="titleSmall" value={compact(journeys.length)} spoken={journeys.length} label={words.profile.you.journeys} />
            <Stat layout="stack" size="titleSmall" value={compact(counts.data?.followerCount ?? 0)} spoken={counts.data?.followerCount ?? 0} label={words.profile.people.followers} divider onPress={() => openPeople('followers')} />
            <Stat layout="stack" size="titleSmall" value={compact(counts.data?.followingCount ?? 0)} spoken={counts.data?.followingCount ?? 0} label={words.profile.people.following} divider onPress={() => openPeople('following')} />
          </View>
        </View>

        {profile.bio || profile.link ? (
          <View style={{ marginTop: 16, marginHorizontal: layout.rowGutter, gap: 4 }}>
            {profile.bio ? <Txt variant="bodySmall">{profile.bio}</Txt> : null}
            {profile.link ? <ProfileLink url={profile.link} /> : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 14, marginHorizontal: layout.barGutter, marginBottom: 6 }}>
          <Button label={words.profile.you.edit} variant="soft" onPress={() => router.push('/edit-profile')} style={{ flex: 1 }} />
          <Button label={words.profile.you.newJourney} variant="soft" onPress={() => router.push('/new')} style={{ flex: 1 }} />
        </View>

        <OutboxLink />

        <WordTabs
          tabs={[
            { id: 'active', label: words.profile.shelves.active, count: shelves.active.length },
            { id: 'completed', label: words.profile.shelves.completed, count: shelves.completed.length },
            { id: 'private', label: words.profile.shelves.private, count: shelves.private.length, icon: (c) => <Lock size={13} color={c} /> },
          ]}
          value={shelf}
          onChange={setShelf}
        />

        {mine.isPending ? (
          <View style={{ height: 200 }}>
            <Loading offline={mine.isPaused} />
          </View>
        ) : mine.isError && !mine.data ? (
          <View style={{ height: 260 }}>
            <Problem message={messageFor(mine.error)} onRetry={() => void mine.refetch()} retrying={mine.isFetching} />
          </View>
        ) : journeys.length === 0 ? (
          <View style={{ marginTop: 36 }}>
            <EmptyState emoji="🗺️" title={words.profile.you.first.title} body={words.profile.you.first.body} action={<Button label={words.profile.you.first.start} onPress={() => router.push('/new')} />} />
          </View>
        ) : shown.length === 0 ? (
          <Txt variant="bodySmall" color="muted" center style={{ marginTop: 40, marginHorizontal: 40 }}>
            {words.profile.you.emptyShelf[shelf]}
          </Txt>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 14, marginHorizontal: 10 }}>
            {shown.map((journey) => (
              <View key={journey.id} style={{ width: '50%', paddingHorizontal: 6, marginBottom: 16 }}>
                <JourneyCard
                  journey={journey}
                  size="grid"
                  pill={journey.status === 'active' ? journey.progressLabel : undefined}
                  detail={journey.status === 'active' ? (journey.followerCount > 0 ? audienceLabel(journey) : visibility(journey.visibility).badge) : words.common.join([journey.progressLabel, audienceLabel(journey)])}
                  onPress={() => router.push(`/journey/${journey.id}`)}
                />
              </View>
            ))}
          </View>
        )}

      </ScrollView>
      <ProfileShareSheet visible={sharing} onClose={() => setSharing(false)} />
    </SafeAreaView>
  );
}
