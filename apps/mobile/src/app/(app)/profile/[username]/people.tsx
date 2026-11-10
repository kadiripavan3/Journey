import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { more, paged, rows } from '@/api/pages';
import { PageProblem } from '@/features/states/PageProblem';
import { List } from '@/ui/List';
import { type ListedPersonResponse, useGetFollowersInfinite, useGetFollowingInfinite, useGetProfile } from '@/api/generated/journey';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { PersonRow } from '@/features/people/PersonRow';
import { wentAway } from '@/lib/loading';
import { compact } from '@/lib/plural';
import { useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Loading } from '@/ui/Loading';
import { Txt } from '@/ui/Txt';
import { WordTabs } from '@/ui/WordTabs';

type Tab = 'followers' | 'following';

/** 9.4 Followers: followers and following in two tabs. Follow back in one tap. */
export default function People() {
  const params = useLocalSearchParams<{ username: string; tab?: string }>();
  const username = params.username;
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(params.tab === 'following' ? 'following' : 'followers');
  const profile = useGetProfile(username);
  const followers = useGetFollowersInfinite(username, undefined, { query: paged });
  const following = useGetFollowingInfinite(username, undefined, { query: paged });
  const list = tab === 'followers' ? followers : following;
  const people = rows(list.data) ?? [];
  const isMe = profile.data?.viewer.isMe;
  // In your own Followers list, everyone here follows you: the button offers to follow back.
  const followsYou = (person: ListedPersonResponse) => !!isMe && tab === 'followers' && !person.viewer.isFollowing;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title={username} trailing={<View style={{ width: 40 }} />} />
      <WordTabs
        tabs={[
          { id: 'followers', label: 'Followers', count: profile.data ? compact(profile.data.followerCount) : undefined },
          { id: 'following', label: 'Following', count: profile.data ? compact(profile.data.followingCount) : undefined },
        ]}
        value={tab}
        onChange={setTab}
      />
      {!list.data || wentAway(list) ? (
        list.isError ? <PageProblem error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} /> : <Loading offline={list.isPaused} />
      ) : people.length === 0 ? (
        <Txt variant="bodySmall" color="muted" center style={{ marginTop: 60, marginHorizontal: 40 }}>
          {tab === 'followers' ? (isMe ? 'Nobody follows you yet. Share a journey and they will.' : 'No followers yet.') : isMe ? "You don't follow anyone yet." : 'Not following anyone yet.'}
        </Txt>
      ) : (
        <List
          data={people}
          keyOf={(person) => person.id}
          row={(person) => (
            <PersonRow
              person={person}
              detail={`@${person.username}${person.latestJourney ? ` · ${person.latestJourney}` : ''}`}
              onPress={() => router.push(`/profile/${person.username}`)}
              trailing={person.viewer.isMe ? null : <PersonFollowButton username={person.username} isFollowing={person.viewer.isFollowing} followsYou={followsYou(person)} />}
            />
          )}
          top={8}
          loadingMore={list.isFetchingNextPage}
          {...more(list)}
        />
      )}
    </SafeAreaView>
  );
}
