import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, List as ListIcon, Map as MapIcon, Plus } from 'lucide-react-native';
import type { FlashListRef } from '@shopify/flash-list';
import { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostingBanner } from '@/features/drafts/PostingBanner';
import { EntryPost } from '@/features/entries/EntryPost';
import { PageProblem } from '@/features/states/PageProblem';
import { DayMarker } from '@/features/story/DayMarker';
import { JumpSheet } from '@/features/story/JumpSheet';
import type { StoryRow } from '@/features/story/rows';
import { useStory } from '@/features/story/useStory';
import { formatDay } from '@/lib/dates';
import { firstName } from '@/lib/names';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { List } from '@/ui/List';
import { Loading } from '@/ui/Loading';
import { Rise } from '@/ui/Motion';
import { RoundButton } from '@/ui/RoundButton';
import { CardSkeleton } from '@/ui/Skeleton';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/**
 * 5.2 Story line: the journey in the order things happened, grouped by day, with quiet days and what's new
 * since your last visit. A day's label stays at the top while its entries scroll underneath. A long story is
 * read a page at a time: it opens at the first new entry (or at the start), loads further pages in both
 * directions as the person scrolls, and "Jump to" can open it anywhere. A shared story can be narrowed to what
 * one person wrote (10.4). The map of its places is one tap away. The rules are in `useStory`.
 */
export default function Timeline() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const list = useRef<FlashListRef<StoryRow>>(null);
  const story = useStory(id, list);
  const [jumping, setJumping] = useState(false);
  const { journey: j, summary: s, rows, load } = story;

  /** The line the story hangs on. It starts at the first entry's dot. */
  const line = (top = 0) => <View style={{ position: 'absolute', top, bottom: 0, left: 27, width: 2, backgroundColor: colors.fill2 }} />;
  const row = (item: StoryRow, index: number) => {
    if (item.kind === 'gap') {
      return (
        <View style={{ paddingHorizontal: layout.barGutter }}>
          {line()}
          <Txt variant="footnote" color="muted" italic style={{ marginLeft: 34, marginBottom: 12 }}>
            {words.story.quietDays(item.days)}
          </Txt>
        </View>
      );
    }
    if (item.kind === 'new') {
      return (
        <View style={{ paddingHorizontal: layout.barGutter }}>
          {line()}
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginBottom: 14, paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.field, backgroundColor: colors.accent }}>
            <ArrowDown size={15} color={colors.onAccent} strokeWidth={2.6} />
            <Txt variant="caption" weight={800} style={{ color: colors.onAccent }}>
              {words.story.newSinceVisit(item.count)}
            </Txt>
          </View>
        </View>
      );
    }
    if (item.kind === 'day') {
      // It has the page's colour behind it: while it is held at the top, the entries pass underneath.
      return (
        <View style={{ paddingHorizontal: layout.barGutter, paddingTop: 6, paddingBottom: 10, backgroundColor: colors.bg }}>
          {line(item.entry.position === 1 ? 16 : 0)}
          <DayMarker entry={item.entry} />
        </View>
      );
    }
    const card = (
      <EntryPost frame="story" entry={item.entry} fresh={story.isNew(item.entry)} showAuthor={story.shared} onPress={() => router.push(`/entry/${item.entry.id}`)} style={{ marginLeft: 34, marginBottom: 14 }} />
    );
    return (
      <View style={{ paddingHorizontal: layout.barGutter }}>
        {line()}
        {index < 8 ? <Rise index={index}>{card}</Rise> : card}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ borderBottomWidth: 1, borderBottomColor: colors.line }}>
        <AppBar
          title={j?.title ?? ''}
          subtitle={j ? words.story.subtitle(j.owner.displayName, j.authors.length - 1, j.entryCount) : undefined}
          trailing={<RoundButton label={words.story.map} onPress={() => router.push(`/journey/${id}/map`)} icon={(c) => <MapIcon size={19} color={c} />} />}
        />
        {j && story.shared ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter, paddingBottom: 10 }}>
            <Chip tone="filter" label={words.story.everyone} selected={story.who === null} onPress={() => story.pickWho(null)} />
            {j.authors.map((author) => (
              <Chip
                key={author.id}
                tone="filter"
                label={firstName(author.displayName)}
                count={story.wrote(author.id)}
                selected={story.who === author.username}
                onPress={() => story.pickWho(author.username)}
                icon={<View style={{ marginLeft: -6, marginVertical: -3 }}><Avatar uri={author.avatarUrl} name={author.displayName} size={22} /></View>}
              />
            ))}
          </ScrollView>
        ) : null}
      </View>
      <PostingBanner journeyId={id} />
      {load.error ? (
        <PageProblem error={load.error} onRetry={load.retry} retrying={load.retrying} />
      ) : !j || !s || !rows ? (
        load.offline ? <Loading offline /> : <CardSkeleton />
      ) : rows.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 }}>
          <Txt variant="body" color="muted" center>
            {story.whoName ? words.story.none.by(story.whoName) : j.viewer.isOwner ? words.story.none.owner : words.story.none.reader}
          </Txt>
          {j.viewer.canAddEntry && !story.who ? <Button label={words.story.addFirst} onPress={() => router.push(`/journey/${j.id}/add`)} style={{ alignSelf: 'center' }} /> : null}
        </View>
      ) : (
        <List
          key={story.listKey}
          listRef={list}
          data={rows}
          keyOf={(item) => item.key}
          typeOf={(item) => item.kind}
          sticky={(item) => item.kind === 'day'}
          startAt={story.startAt}
          top={10}
          bottom={110 + insets.bottom}
          loadingMore={story.loadingMore}
          onEnd={story.onEnd}
          onStart={story.onStart}
          footer={
            j.status === 'completed' && story.atEnd ? (
              <Txt variant="caption" color="muted" weight={700} style={{ marginLeft: layout.barGutter + 34, marginTop: 2 }}>
                {words.common.join([words.story.completed, j.completedAt ? formatDay(j.completedAt.slice(0, 10)) : null])}
              </Txt>
            ) : null
          }
          row={row}
        />
      )}
      {(story.who ? (j?.entryCount ?? 0) : story.total) > 3 ? (
        <View style={{ position: 'absolute', left: layout.barGutter, bottom: Math.max(insets.bottom, 12) + 12 }}>
          <Button label={words.story.jumpTo} size="lg" variant="ink" icon={(c) => <ListIcon size={19} color={c} />} onPress={() => setJumping(true)} />
        </View>
      ) : null}
      {s ? (
        <JumpSheet
          visible={jumping}
          onClose={() => setJumping(false)}
          summary={s}
          fresh={story.opened}
          days={story.days}
          everyDay={story.everyDay}
          onJump={(entryId) => {
            setJumping(false);
            story.jumpTo(entryId);
          }}
        />
      ) : null}
      {j?.viewer.canAddEntry && story.total > 0 ? (
        <View style={{ position: 'absolute', right: layout.barGutter, bottom: Math.max(insets.bottom, 12) + 12 }}>
          <Button label={words.story.addEntry} size="lg" icon={(c) => <Plus size={20} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add`)} />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
