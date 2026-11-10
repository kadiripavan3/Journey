import { keepPreviousData } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { more, paged, rows } from '@/api/pages';
import { PageProblem } from '@/features/states/PageProblem';
import { List } from '@/ui/List';
import { type ListedPersonResponse, useGetFollowersInfinite, useGetFollowingInfinite, useGetProfile } from '@/api/generated/journey';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { PersonRow } from '@/features/people/PersonRow';
import { wentAway } from '@/lib/loading';
import { compact } from '@/lib/compact';
import { useDebounced } from '@/lib/useDebounced';
import { layout, radius, textStyle, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { MAX_TEXT_SCALE, Txt } from '@/ui/Txt';
import { webNoOutline } from '@/ui/web';
import { WordTabs } from '@/ui/WordTabs';
import { words } from '@/words';

type Tab = 'followers' | 'following';

/** 9.4 Followers: followers and following in two tabs, with a search inside each. Follow back in one tap. */
export default function People() {
  const params = useLocalSearchParams<{ username: string; tab?: string }>();
  const username = params.username;
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>(params.tab === 'following' ? 'following' : 'followers');
  const profile = useGetProfile(username);
  const [text, setText] = useState('');
  const letters = useDebounced(text.trim(), 300);
  // The list that is on screen stays while the next letters are looked up.
  const asked = { query: { ...paged, placeholderData: keepPreviousData } };
  const followers = useGetFollowersInfinite(username, letters ? { q: letters } : undefined, asked);
  const following = useGetFollowingInfinite(username, letters ? { q: letters } : undefined, asked);
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
          { id: 'followers', label: words.profile.people.followers, count: profile.data ? compact(profile.data.followerCount) : undefined },
          { id: 'following', label: words.profile.people.following, count: profile.data ? compact(profile.data.followingCount) : undefined },
        ]}
        value={tab}
        onChange={setTab}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, marginHorizontal: layout.barGutter, marginTop: 10, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.fill }}>
        <SearchIcon size={18} color={colors.muted} />
        <TextInput
          maxFontSizeMultiplier={MAX_TEXT_SCALE}
          accessibilityLabel={words.profile.people.search[tab]}
          value={text}
          onChangeText={setText}
          placeholder={words.profile.people.search[tab]}
          placeholderTextColor={colors.muted}
          selectionColor={colors.accent}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[webNoOutline, textStyle('item', 600, { oneLine: true }), { flex: 1, padding: 0, color: colors.text }]}
        />
        {text ? (
          <Tap accessibilityRole="button" accessibilityLabel={words.profile.people.search.clear} hitSlop={13} scaleTo={0.9} onPress={() => setText('')}>
            <X size={18} color={colors.muted} />
          </Tap>
        ) : null}
      </View>
      {!list.data || wentAway(list) ? (
        list.isError ? <PageProblem error={list.error} onRetry={() => void list.refetch()} retrying={list.isFetching} /> : <Loading offline={list.isPaused} />
      ) : people.length === 0 ? (
        <Txt variant="bodySmall" color="muted" center style={{ marginTop: 60, marginHorizontal: 40 }}>
          {letters
            ? words.profile.people.none.matching(letters)
            : tab === 'followers'
              ? isMe
                ? words.profile.people.none.yourFollowers
                : words.profile.people.none.followers
              : isMe
                ? words.profile.people.none.yourFollowing
                : words.profile.people.none.following}
        </Txt>
      ) : (
        <List
          data={people}
          keyOf={(person) => person.id}
          row={(person) => (
            <PersonRow
              person={person}
              detail={words.common.join([`@${person.username}`, person.latestJourney])}
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
