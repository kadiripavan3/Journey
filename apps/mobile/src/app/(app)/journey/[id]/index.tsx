import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, BookOpen, Camera, Ellipsis, Map as MapIcon, Share2, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetJourney, useGetJourneySummary } from '@/api/generated/journey';
import { EntryRow } from '@/features/entries/EntryRow';
import { useCatalog } from '@/features/journeys/catalog';
import { ChallengeCard } from '@/features/journeys/ChallengeCard';
import { JourneyBar } from '@/features/journeys/JourneyBar';
import { JourneyMenu } from '@/features/journeys/JourneyMenus';
import { PausedNote } from '@/features/journeys/PausedNote';
import { STATUS } from '@/features/journeys/status';
import { useLeave } from '@/features/navigation/useLeave';
import { JourneyShareSheet } from '@/features/sharing/ShareSheet';
import { PageProblem } from '@/features/states/PageProblem';
import { daysBetween, today } from '@/lib/dates';
import { loadState } from '@/lib/loading';
import { firstName } from '@/lib/names';
import { compact, plural } from '@/lib/plural';
import { layout, radius, useTheme, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { LightStatusBar } from '@/ui/LightStatusBar';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { RoundButton } from '@/ui/RoundButton';
import { HeroSkeleton } from '@/ui/Skeleton';
import { Stat } from '@/ui/Stat';
import { Txt } from '@/ui/Txt';

/** 5.1 Journey: photo first, the creator's face on the sheet, honest stats, highlights, and one strong Follow button that floats. */
export default function JourneyPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const leave = useLeave();
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const catalog = useCatalog();
  const journey = useGetJourney(id);
  // What this page shows of the story (the newest entries, the first photos, the ticked days) comes ready from the API.
  const summary = useGetJourneySummary(id);
  const [menu, setMenu] = useState(false);
  const [sharing, setSharing] = useState(false);
  const load = loadState(journey);

  const j = journey.data;
  if (!j) {
    // Not here yet, or not at all: the way back stays, on the page's own colours.
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {load.error ? (
          <View style={{ flex: 1, paddingTop: insets.top + 56, paddingBottom: insets.bottom }}>
            <PageProblem error={load.error} onRetry={load.retry} retrying={load.retrying} />
          </View>
        ) : load.offline ? (
          <Loading offline />
        ) : (
          <HeroSkeleton />
        )}
        <View style={{ position: 'absolute', top: insets.top + 8, left: layout.barGutter }}>
          <RoundButton label="Back" onPress={leave} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
      </View>
    );
  }

  const photos = (summary.data?.photos ?? []).map((photo) => photo.thumbUrl ?? photo.url);
  const photoCount = summary.data?.photoCount ?? 0;
  const latest = summary.data?.latest ?? [];
  const first = firstName(j.owner.displayName);
  const category = catalog.category(j.category);
  const openStory = () => router.push(`/journey/${j.id}/timeline`);
  const openOwner = () => router.push(`/profile/${j.owner.username}`);
  const shared = j.authors.length > 1;
  const authorNames = j.authors.length <= 2 ? j.authors.map((a) => a.displayName).join(' and ') : `${j.owner.displayName} and ${j.authors.length - 1} others`;
  const statusColor = j.status === 'active' ? colors.ok : j.status === 'completed' ? colors.done : colors.warn;
  // A challenge asks for one check-in a day: the button is there until today has one.
  const checkedInToday = (summary.data?.days ?? []).includes(daysBetween(j.startDate, today()) + 1);
  const canCheckIn = !!j.targetDays && j.status === 'active' && j.viewer.canAddEntry && !!summary.data && !checkedInToday;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LightStatusBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Photo uri={j.coverUrl} radius="none" style={{ height: 338, backgroundColor: colors.fill2 }} label={`Cover photo of ${j.title}`}>
          <LinearGradient colors={[withAlpha(colors.black, 0.38), withAlpha(colors.black, 0)]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }} />
        </Photo>
        <View style={{ marginTop: -30, paddingTop: 52, paddingHorizontal: layout.gutter, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.bg, alignItems: 'center' }}>
          <Tap
            accessibilityRole="button"
            accessibilityLabel={`${j.owner.displayName}'s profile`}
            scaleTo={0.94}
            onPress={openOwner}
            style={{ position: 'absolute', top: -38, borderRadius: radius.pill, borderWidth: 4, borderColor: colors.bg, boxShadow: shadow.float }}>
            <Avatar uri={j.owner.avatarUrl} name={j.owner.displayName} size={76} />
          </Tap>
          <Txt variant="titleLarge" accessibilityRole="header" center>
            {j.title}
          </Txt>
          {j.description ? (
            <Txt variant="body" color="muted" center style={{ marginTop: 10, maxWidth: 320 }}>
              {j.description}
            </Txt>
          ) : null}
          <Txt variant="caption" center weight={700} onPress={openOwner} style={{ marginTop: 10 }}>
            {authorNames}
            {category ? <Txt variant="caption" color="muted" weight={500}>{` · ${category.label}`}</Txt> : null}
          </Txt>

          {shared ? (
            <Tap accessibilityRole="button" accessibilityLabel={`Shared journey. ${authorNames}. See the people`} hitSlop={{ top: 8, bottom: 8 }} onPress={() => router.push(`/journey/${j.id}/people`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <View style={{ flexDirection: 'row' }}>
                {j.authors.slice(0, 4).map((author, index) => (
                  <View key={author.id} style={{ marginLeft: index === 0 ? 0 : -8, borderRadius: radius.thumb, borderWidth: 2, borderColor: colors.bg }}>
                    <Avatar uri={author.avatarUrl} name={author.displayName} size={24} />
                  </View>
                ))}
              </View>
              <Pill label="Shared journey" style={{ backgroundColor: colors.fill }} />
            </Tap>
          ) : null}

          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 18, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
            <Stat value={j.progressLabel} label={STATUS[j.status]} dot={statusColor} />
            <Stat value={String(j.entryCount)} label={j.entryCount === 1 ? 'entry' : 'entries'} divider />
            <Stat value={compact(j.followerCount)} label={j.targetDays ? 'cheering' : 'following'} divider />
          </View>

          {j.status === 'paused' ? <PausedNote journey={j} /> : null}

          {j.targetDays ? <ChallengeCard journey={j} days={summary.data?.days ?? []} /> : null}
          {canCheckIn ? (
            <Button label="Post today's check-in" size="lg" block icon={(c) => <Camera size={19} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add`)} style={{ marginTop: 14 }} />
          ) : null}

          {j.status === 'completed' ? (
            <Button label="See the recap" variant="soft" block icon={(c) => <Sparkles size={18} color={c} />} onPress={() => router.push(`/journey/${j.id}/recap`)} style={{ marginTop: 18 }} />
          ) : null}

          {photos.length >= 3 ? (
            <Tap accessibilityRole="button" accessibilityLabel={`${plural(photoCount, 'photo')}. Open the story.`} scaleTo={0.985} onPress={openStory} style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 6, height: 206, marginTop: 18, borderRadius: radius.card, overflow: 'hidden' }}>
              <Photo uri={photos[0]} radius="none" style={{ flex: 1.25 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Photo uri={photos[1]} radius="none" style={{ flex: 1 }} />
                <Photo uri={photos[2]} radius="none" style={{ flex: 1 }}>
                  {photoCount > 3 ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim }}>
                      <Txt variant="subtitle" style={{ color: colors.onPhoto }}>
                        +{photoCount - 3}
                      </Txt>
                    </View>
                  ) : null}
                </Photo>
              </View>
            </Tap>
          ) : null}

          <View style={{ alignSelf: 'stretch', gap: 18, marginTop: 18 }}>
            {!summary.data ? (
              summary.isError ? (
                <Txt color="muted" center>
                  {messageFor(summary.error)}
                </Txt>
              ) : (
                <View style={{ height: 120 }}>
                  <Loading offline={summary.isPaused} />
                </View>
              )
            ) : latest.length === 0 ? (
              <Txt variant="bodySmall" color="muted" center style={{ marginVertical: 20 }}>
                {j.viewer.isOwner ? 'Your story starts with the first entry.' : j.viewer.isMember ? 'The story starts with the first entry. It could be yours.' : `${first} hasn't added an entry yet. Follow to hear about the first one.`}
              </Txt>
            ) : (
              <>
                {latest.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onPress={() => router.push(`/entry/${entry.id}`)} />
                ))}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button label={j.entryCount > 3 ? `Read all ${j.entryCount} entries` : 'Read the story'} variant="line" icon={(c) => <BookOpen size={18} color={c} />} onPress={openStory} style={{ flex: 1 }} />
                  <Button label="Map" variant="line" icon={(c) => <MapIcon size={18} color={c} />} onPress={() => router.push(`/journey/${j.id}/map`)} />
                </View>
              </>
            )}
          </View>
          {j.status === 'completed' && j.closingNote ? (
            <View style={{ alignSelf: 'stretch', marginTop: 18, padding: 16, borderRadius: radius.photo, backgroundColor: colors.fill }}>
              <Txt variant="label" color="muted">
                Closing note
              </Txt>
              <Txt variant="bodySmall" style={{ marginTop: 6 }}>{j.closingNote}</Txt>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: layout.barGutter, right: layout.barGutter, flexDirection: 'row', justifyContent: 'space-between' }}>
        <RoundButton tone="photo" label="Back" onPress={leave} icon={(c) => <ArrowLeft size={20} color={c} />} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {j.shareUrl ? <RoundButton tone="photo" label="Share this journey" icon={(c) => <Share2 size={19} color={c} />} onPress={() => setSharing(true)} /> : null}
          <RoundButton tone="photo" label="Journey options" onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} />
        </View>
      </View>

      <JourneyBar journey={j} style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12) + 8 }} />
      <JourneyMenu journey={j} visible={menu} onClose={() => setMenu(false)} />
      <JourneyShareSheet journey={j} visible={sharing} onClose={() => setSharing(false)} />
    </View>
  );
}
