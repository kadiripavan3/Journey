import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { more, paged, rows } from '@/api/pages';
import { List } from '@/ui/List';
import { type ListedPersonResponse, useGetFollowersInfinite, useGetFollowingInfinite, useGetProfile } from '@/api/generated/journey';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { compact } from '@/lib/plural';
import { layout, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { Txt } from '@/ui/Txt';
import { WordTabs } from '@/ui/WordTabs';

type Tab = 'followers' | 'following';

/** 9.4 Followers: followers and following in two tabs. Follow back in one tap. */
export default function People() {
  const params = useLocalSearchParams<{ username: string; tab?: string }>();
  const username = params.username;
  const { colors } = useTheme();
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
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Problem message={messageFor(list.error)} onRetry={() => void list.refetch()} retrying={list.isRefetching} />
      ) : people.length === 0 ? (
        <Txt variant="bodySmall" color="muted" center style={{ marginTop: 60, marginHorizontal: 40 }}>
          {tab === 'followers' ? (isMe ? 'Nobody follows you yet. Share a journey and they will.' : 'No followers yet.') : isMe ? "You don't follow anyone yet." : 'Not following anyone yet.'}
        </Txt>
      ) : (
        <List
          data={people}
          keyOf={(person) => person.id}
          row={(person) => <PersonRow person={person} followsYou={followsYou(person)} />}
          top={8}
          loadingMore={list.isFetchingNextPage}
          {...more(list)}
        />
      )}
    </SafeAreaView>
  );
}

function PersonRow({ person, followsYou }: { person: ListedPersonResponse; followsYou: boolean }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: layout.rowGutter }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${person.displayName}, @${person.username}`}
        onPress={() => router.push(`/profile/${person.username}`)}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}>
        <Avatar uri={person.avatarUrl} name={person.displayName} size={48} />
        <View style={{ flex: 1 }}>
          <Txt variant="item" numberOfLines={1}>
            {person.displayName}
          </Txt>
          <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
            @{person.username}
            {person.latestJourney ? ` · ${person.latestJourney}` : ''}
          </Txt>
        </View>
      </Pressable>
      {person.viewer.isMe ? null : <PersonFollowButton username={person.username} isFollowing={person.viewer.isFollowing} followsYou={followsYou} />}
    </View>
  );
}
