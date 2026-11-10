import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type ListedPersonResponse, useGetFollowers, useGetFollowing, useGetProfile } from '@/api/generated/journey';
import { compact } from '@/lib/plural';
import { useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Loading, Problem } from '@/ui/Bits';
import { PersonFollowButton } from '@/ui/PersonFollowButton';
import { Txt } from '@/ui/Txt';

type Tab = 'followers' | 'following';

/** 9.4 Followers: followers and following in two tabs. Follow back in one tap. */
export default function People() {
  const params = useLocalSearchParams<{ username: string; tab?: string }>();
  const username = params.username;
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>(params.tab === 'following' ? 'following' : 'followers');
  const profile = useGetProfile(username);
  const followers = useGetFollowers(username);
  const following = useGetFollowing(username);
  const list = tab === 'followers' ? followers : following;
  const isMe = profile.data?.viewer.isMe;
  // In your own Followers list, everyone here follows you: the button offers to follow back.
  const followsYou = (person: ListedPersonResponse) => !!isMe && tab === 'followers' && !person.viewer.isFollowing;

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title={username} trailing={<View style={{ width: 40 }} />} />
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 24, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <PeopleTab label="Followers" count={profile.data?.followerCount} on={tab === 'followers'} onPress={() => setTab('followers')} />
        <PeopleTab label="Following" count={profile.data?.followingCount} on={tab === 'following'} onPress={() => setTab('following')} />
      </View>
      {list.isPending ? (
        <Loading />
      ) : list.isError ? (
        <Problem error={list.error} onRetry={() => void list.refetch()} retrying={list.isRefetching} />
      ) : list.data.length === 0 ? (
        <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22, marginTop: 60, marginHorizontal: 40 }}>
          {tab === 'followers' ? (isMe ? 'Nobody follows you yet. Share a journey and they will.' : 'No followers yet.') : isMe ? "You don't follow anyone yet." : 'Not following anyone yet.'}
        </Txt>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {list.data.map((person) => (
            <PersonRow key={person.id} person={person} followsYou={followsYou(person)} />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PersonRow({ person, followsYou }: { person: ListedPersonResponse; followsYou: boolean }) {
  const router = useRouter();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 20 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${person.displayName}, @${person.username}`}
        onPress={() => router.push(`/profile/${person.username}` as never)}
        style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}>
        <Avatar uri={person.avatarUrl} name={person.displayName} size={48} />
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1} weight={700} style={{ fontSize: 15, lineHeight: 20 }}>
            {person.displayName}
          </Txt>
          <Txt numberOfLines={1} color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
            @{person.username}
            {person.latestJourney ? ` · ${person.latestJourney}` : ''}
          </Txt>
        </View>
      </Pressable>
      {person.viewer.isMe ? null : <PersonFollowButton username={person.username} isFollowing={person.viewer.isFollowing} followsYou={followsYou} />}
    </View>
  );
}

function PeopleTab({ label, count, on, onPress }: { label: string; count?: number; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const color = on ? colors.text : colors.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={count === undefined ? label : `${label}, ${count}`} accessibilityState={{ selected: on }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 }}>
      <Txt weight={700} style={{ fontSize: 15, lineHeight: 20, color }}>
        {label}
      </Txt>
      {count === undefined ? null : (
        <Txt weight={600} style={{ fontSize: 12.5, lineHeight: 17, color }}>
          {compact(count)}
        </Txt>
      )}
      {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2, backgroundColor: colors.text }} /> : null}
    </Pressable>
  );
}
