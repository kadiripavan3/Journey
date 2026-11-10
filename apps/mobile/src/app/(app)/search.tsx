import { useRouter } from 'expo-router';
import { Search as SearchIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, TextInput, type TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type JourneyResponse, type ListedPersonResponse, useGetDiscover, useSearch } from '@/api/generated/journey';
import { compact } from '@/lib/plural';
import { useDebounced } from '@/lib/useDebounced';
import { fontFor, useTheme } from '@/theme';
import { BarLink } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { JourneyRow, Loading, Problem } from '@/ui/Bits';
import { GroupLabel } from '@/ui/Heading';
import { PersonFollowButton } from '@/ui/PersonFollowButton';
import { Txt } from '@/ui/Txt';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;
const STATUS = { active: 'Active', paused: 'Paused', completed: 'Completed' } as const;

/** What was searched for earlier in this run of the app, newest first. */
let recent: string[] = [];
const remember = (words: string) => {
  recent = [words, ...recent.filter((r) => r !== words)].slice(0, 5);
};

/** 4.2 and 4.3 Search: popular tags before you type, then journeys and people in two tabs. */
export default function Search() {
  const router = useRouter();
  const { colors } = useTheme();
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

  const open = (href: string) => {
    if (words) remember(words);
    router.push(href as never);
  };
  const journeys = results.data?.journeys ?? [];
  const people = results.data?.people ?? [];

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, height: 46, paddingHorizontal: 16, borderRadius: 23, borderWidth: 2, borderColor: colors.text }}>
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
            style={[webNoOutline, { flex: 1, padding: 0, fontFamily: fontFor[600], fontSize: 15, color: colors.text }]}
          />
          {text ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear" hitSlop={10} onPress={() => setText('')}>
              <X size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        <BarLink label="Cancel" quiet onPress={() => router.back()} />
      </View>

      {!searching ? (
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {recent.length > 0 ? (
            <>
              <GroupLabel style={{ marginHorizontal: 22 }}>Recent</GroupLabel>
              {recent.map((r) => (
                <Pressable key={r} accessibilityRole="button" accessibilityLabel={`Search for ${r}`} onPress={() => setText(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 22 }}>
                  <SearchIcon size={16} color={colors.muted} />
                  <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
                    {r}
                  </Txt>
                </Pressable>
              ))}
            </>
          ) : null}
          {tags.length > 0 ? (
            <>
              <GroupLabel style={{ marginHorizontal: 22 }}>Popular tags</GroupLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 20 }}>
                {tags.map((tag) => (
                  <Pressable key={tag} accessibilityRole="button" accessibilityLabel={`Search for the tag ${tag}`} onPress={() => setText(`#${tag}`)} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: 18, backgroundColor: colors.fill }}>
                    <Txt weight={700} style={{ fontSize: 13.5, lineHeight: 18 }}>
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
          <View accessibilityRole="tablist" style={{ flexDirection: 'row', gap: 24, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <ResultTab label="Journeys" count={results.data ? journeys.length : undefined} on={tab === 'journeys'} onPress={() => setTab('journeys')} />
            <ResultTab label="People" count={results.data ? people.length : undefined} on={tab === 'people'} onPress={() => setTab('people')} />
          </View>
          {results.isPending ? (
            <Loading />
          ) : results.isError ? (
            <Problem error={results.error} onRetry={() => void results.refetch()} retrying={results.isRefetching} />
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
  return <JourneyRow coverUrl={journey.coverUrl} title={journey.title} detail={`${STATUS[journey.status]} · ${journey.progressLabel} · ${journey.owner.displayName}${followers}`} onPress={onPress} />;
}

function PersonResult({ person, onPress }: { person: ListedPersonResponse; onPress: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 20 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${person.displayName}, @${person.username}`} onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
      {person.viewer.isMe ? null : <PersonFollowButton username={person.username} isFollowing={person.viewer.isFollowing} />}
    </View>
  );
}

function Nothing({ words, what }: { words: string; what: string }) {
  return (
    <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22, marginTop: 60, marginHorizontal: 40 }}>
      No {what} match “{words}”. Try fewer or different words.
    </Txt>
  );
}

function ResultTab({ label, count, on, onPress }: { label: string; count?: number; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const color = on ? colors.text : colors.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={count === undefined ? label : `${label}, ${count}`} accessibilityState={{ selected: on }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 }}>
      <Txt weight={700} style={{ fontSize: 15, lineHeight: 20, color }}>
        {label}
      </Txt>
      {count === undefined ? null : (
        <Txt weight={600} style={{ fontSize: 12.5, lineHeight: 17, color }}>
          {count}
        </Txt>
      )}
      {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2, backgroundColor: colors.text }} /> : null}
    </Pressable>
  );
}
