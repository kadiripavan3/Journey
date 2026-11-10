import { type Href, useRouter } from 'expo-router';
import { Hash, Search as SearchIcon, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type JourneyResponse, useGetDiscover, useSearch } from '@/api/generated/journey';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { STATUS } from '@/features/journeys/status';
import { useLeave } from '@/features/navigation/useLeave';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { PersonRow } from '@/features/people/PersonRow';
import { useRecentSearches } from '@/features/search/recent';
import { PageProblem } from '@/features/states/PageProblem';
import { followingLabel } from '@/lib/following';
import { plural } from '@/words/en/plural';
import { useDebounced } from '@/lib/useDebounced';
import { layout, radius, textStyle, useTheme } from '@/theme';
import { BarLink } from '@/ui/AppBar';
import { GroupLabel } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { MAX_TEXT_SCALE, Txt } from '@/ui/Txt';
import { webNoOutline } from '@/ui/web';
import { WordTabs } from '@/ui/WordTabs';

/** The tags a list of journeys uses, most used first, with how many of the journeys use each. */
function tagsOf(journeys: readonly JourneyResponse[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const journey of journeys) for (const tag of journey.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
}

/**
 * 4.2 and 4.3 Search: popular tags before you type, then journeys, people and tags in tabs. The Tags tab lists
 * the tags the matching journeys use; tapping one searches for it.
 */
export default function Search() {
  const router = useRouter();
  const leave = useLeave();
  const { colors } = useTheme();
  const { recent, remember } = useRecentSearches();
  const [text, setText] = useState('');
  const [tab, setTab] = useState<'journeys' | 'people' | 'tags'>('journeys');
  const words = useDebounced(text.trim(), 300);
  const searching = words.length >= 2;
  const results = useSearch({ q: words }, { query: { enabled: searching } });
  const trending = useGetDiscover(undefined, { query: { enabled: !searching } });

  // Popular tags are the ones the trending journeys use most.
  const popular = tagsOf(trending.data?.trending ?? []).slice(0, 8);

  const open = (href: Href) => {
    if (words) remember(words);
    router.push(href);
  };
  const journeys = results.data?.journeys ?? [];
  const people = results.data?.people ?? [];
  const tags = tagsOf(journeys);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: layout.barGutter, paddingTop: 8, paddingBottom: 10 }}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.text }}>
          <SearchIcon size={18} color={colors.text} />
          <TextInput
            maxFontSizeMultiplier={MAX_TEXT_SCALE}
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
            <Tap accessibilityRole="button" accessibilityLabel="Clear" hitSlop={13} scaleTo={0.9} onPress={() => setText('')}>
              <X size={18} color={colors.muted} />
            </Tap>
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
                <Tap key={r} accessibilityRole="button" accessibilityLabel={`Search for ${r}`} scaleTo={0.985} onPress={() => setText(r)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44, paddingVertical: 11, paddingHorizontal: layout.gutter }}>
                  <SearchIcon size={16} color={colors.muted} />
                  <Txt variant="item" weight={600}>
                    {r}
                  </Txt>
                </Tap>
              ))}
            </>
          ) : null}
          {popular.length > 0 ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.gutter }}>Popular tags</GroupLabel>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: layout.rowGutter }}>
                {popular.map(({ tag }) => (
                  <Tap key={tag} accessibilityRole="button" accessibilityLabel={`Search for the tag ${tag}`} hitSlop={{ top: 5, bottom: 5 }} scaleTo={0.94} onPress={() => setText(`#${tag}`)} style={{ paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.photo, backgroundColor: colors.fill }}>
                    <Txt variant="note" weight={700}>
                      #{tag}
                    </Txt>
                  </Tap>
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
              { id: 'tags', label: 'Tags', count: results.data ? tags.length : undefined },
            ]}
            value={tab}
            onChange={setTab}
          />
          {!results.data ? (
            results.isError ? <PageProblem error={results.error} onRetry={() => void results.refetch()} retrying={results.isFetching} /> : <Loading offline={results.isPaused} />
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}>
              {tab === 'journeys' ? (
                journeys.length === 0 ? (
                  <Nothing words={words} what="journeys" />
                ) : (
                  journeys.map((journey) => (
                    <JourneyRow
                      key={journey.id}
                      coverUrl={journey.coverThumbUrl}
                      title={journey.title}
                      detail={`${STATUS[journey.status]} · ${journey.progressLabel} · ${journey.owner.displayName}${journey.followerCount > 0 ? ` · ${followingLabel(journey.followerCount)}` : ''}`}
                      onPress={() => open(`/journey/${journey.id}`)}
                    />
                  ))
                )
              ) : tab === 'people' ? (
                people.length === 0 ? (
                  <Nothing words={words} what="people" />
                ) : (
                  people.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      detail={`@${person.username}${person.latestJourney ? ` · ${person.latestJourney}` : ''}`}
                      onPress={() => open(`/profile/${person.username}`)}
                      trailing={person.viewer.isMe ? null : <PersonFollowButton username={person.username} isFollowing={person.viewer.isFollowing} />}
                    />
                  ))
                )
              ) : tags.length === 0 ? (
                <Nothing words={words} what="tags" />
              ) : (
                tags.map(({ tag, count }) => (
                  <Tap key={tag} accessibilityRole="button" accessibilityLabel={`Search for the tag ${tag}. ${plural(count, 'journey')} here`} scaleTo={0.985} onPress={() => setText(`#${tag}`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 10, paddingHorizontal: layout.rowGutter }}>
                    <View style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>
                      <Hash size={18} color={colors.text} />
                    </View>
                    <Txt variant="item" numberOfLines={1} style={{ flex: 1 }}>
                      {tag}
                    </Txt>
                    <Txt variant="footnote" color="muted">
                      {plural(count, 'journey')}
                    </Txt>
                  </Tap>
                ))
              )}
            </ScrollView>
          )}
        </>
      )}
    </SafeAreaView>
  );
}

function Nothing({ words, what }: { words: string; what: string }) {
  return (
    <Txt variant="bodySmall" color="muted" center style={{ marginTop: 60, marginHorizontal: 40 }}>
      No {what} match “{words}”. Try fewer or different words.
    </Txt>
  );
}
