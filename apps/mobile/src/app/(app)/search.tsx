import { type Href, useRouter } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, type ListedPersonResponse, useGetDiscover, useSearch } from '@/api/generated/journey';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { STATUS } from '@/features/journeys/status';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { useRecentSearches } from '@/features/search/recent';
import { useLeave } from '@/features/navigation/useLeave';
import { compact } from '@/lib/plural';
import { useDebounced } from '@/lib/useDebounced';
import { layout, radius, textStyle, useTheme } from '@/theme';
import { BarLink } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { GroupLabel } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { Txt } from '@/ui/Txt';
import { webNoOutline } from '@/ui/web';
import { WordTabs } from '@/ui/WordTabs';

/** 4.2 and 4.3 Search: popular tags before you type, then journeys and people in two tabs. */
export default function Search() {
  const router = useRouter();
  const leave = useLeave();
  const { colors } = useTheme();
  const { recent, remember } = useRecentSearches();
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'journeys' | 'people'>('journeys');
  const words = useDebounced(text.trim(), 300);
  const searching = words.length >= 2;
  const results = useSearch({ q: words }, { query: { enabled: searching } });
  const trending = useGetDiscover(undefined, { query: { enabled: !searching } });

  // Popular tags are the ones the trending journeys use most.
  const counts = new Map<string, number>();
  for (const journey of trending.data?.trending ?? []) for (const tag of journey.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  const tags = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([tag]) => tag);

  const open = (href: Href) => {
    if (words) remember(words);
    router.push(href);
  };
  const journeys = results.data?.journeys ?? [];
  const people = results.data?.people ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: layout.barGutter, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.text }}>
          <SearchIcon size={18} color={colors.text} />
          <TextInput
            accessibilityLabel="Search journeys, people and tags"
            value={text}
            onChangeText={setText}
            placeholder="Journeys, people, #tags"
            placeholderTextColor={colors.muted}
            selectionColor={colors.accent}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[webNoOutline, textStyle('item', 600, { oneLine: true }), { flex: 1, padding: 0, color: colors.text }]}
          />
          {text ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} onPress={() => setText('')}>
              <X size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <BarLink label="Cancel" quiet onPress={leave} />
      </View>

      {!searching ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {recent.length > 0 ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.gutter }}>Recent</GroupLabel>
              {recent.map((r) => (
                <Pressable key={r} accessibilityRole="button" accessibilityLabel={`Search for ${r}`} onPress={() => setText(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: layout.gutter }}>
                  <SearchIcon size={16} color={colors.muted} />
                  <Txt variant="item" weight={600}>
                    {r}
                  </Txt>
                </Pressable>
              ))}
            </>
          ) : null}
          {tags.length > 0 ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.gutter }}>Popular tags</GroupLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: layout.rowGutter }}>
                {tags.map((tag) => (
                  <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Search for the tag ${tag}`} onPress={() => setText(`#${tag}`)} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.photo, backgroundColor: colors.fill }}>
                    <Txt variant="note" weight={700}>
                      #{tag}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : (
        <>
          <WordTabs
            tabs={[
              { id: 'journeys', label: 'Journeys', count: results.data ? journeys.length : undefined },
              { id: 'people', label: 'People', count: results.data ? people.length : undefined },
            ]}
            value={tab}
            onChange={setTab}
          />
          {results.isPending ? (
            <Loading />
          ) : results.isError ? (
            <Problem message={messageFor(results.error)} onRetry={() => void results.refetch()} retrying={results.isRefetching} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
              {tab === 'journeys' ? (
                journeys.length === 0 ? (
                  <Nothing words={words} what="journeys" />
                ) : (
                  journeys.map((journey) => <JourneyResult key={journey.id} journey={journey} onPress={() => open(`/journey/${journey.id}`)} />)
                )
              ) : people.length === 0 ? (
                <Nothing words={words} what="people" />
              ) : (
                people.map((person) => <PersonResult key={person.id} person={person} onPress={() => open(`/profile/${person.username}`)} />)
              )}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function JourneyResult({ journey, onPress }: { journey: JourneyResponse; onPress: () => void }) {
  const followers = journey.followerCount > 0 ? ` · ${compact(journey.followerCount)} following` : '';
  return <JourneyRow coverUrl={journey.coverThumbUrl} title={journey.title} detail={`${STATUS[journey.status]} · ${journey.progressLabel} · ${journey.owner.displayName}${followers}`} onPress={onPress} />;
}

function PersonResult({ person, onPress }: { person: ListedPersonResponse; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: layout.rowGutter }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${person.displayName}, @${person.username}`} onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
      {person.viewer.isMe ? null : <PersonFollowButton username={person.username} isFollowing={person.viewer.isFollowing} />}
    </View>
  );
}

function Nothing({ words, what }: { words: string; what: string }) {
  return (
    <Txt variant="bodySmall" color="muted" center style={{ marginTop: 60, marginHorizontal: 40 }}>
      No {what} match “{words}”. Try fewer or different words.
    </Txt>
  );
}
