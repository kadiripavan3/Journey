import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, BookOpen, CircleCheck, Ellipsis, Flag, Pause, Pencil, Play, Plus, Share2, Sparkles, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, useDeleteJourney, useGetJourney, useGetTimeline, useUpdateJourney } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { EntryRow } from '@/features/entries/EntryRow';
import { useCatalog } from '@/features/journeys/catalog';
import { ChallengeCard } from '@/features/journeys/ChallengeCard';
import { FollowButton } from '@/features/journeys/FollowButton';
import { STATUS } from '@/features/journeys/status';
import { ReportSheet } from '@/features/safety/SafetySheets';
import { firstName } from '@/lib/names';
import { compact, plural } from '@/lib/plural';
import { shareLink } from '@/lib/share';
import { layout, radius, useTheme, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { GlassBar } from '@/ui/GlassBar';
import { Loading } from '@/ui/Loading';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Stat } from '@/ui/Stat';
import { Txt } from '@/ui/Txt';

/** 5.1 Journey: photo first, the creator's face on the sheet, honest stats, highlights, and one strong Follow button that floats. */
export default function JourneyPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const catalog = useCatalog();
  const journey = useGetJourney(id);
  const timeline = useGetTimeline(id);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (journey.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading />
      </View>
    );
  }
  if (journey.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: layout.barGutter, paddingTop: 8 }}>
          <RoundButton label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
        <Problem message={messageFor(journey.error)} onRetry={() => void journey.refetch()} retrying={journey.isRefetching} />
      </View>
    );
  }

  const j = journey.data;
  const entries = timeline.data ?? [];
  const photos = entries.flatMap((entry) => entry.media.filter((m) => m.kind === 'photo').map((m) => m.url));
  const latest = [...entries].reverse().slice(0, 3);
  const first = firstName(j.owner.displayName);
  const category = catalog.category(j.category);
  const openStory = () => router.push(`/journey/${j.id}/timeline`);
  const openOwner = () => router.push(`/profile/${j.owner.username}`);
  const shared = j.authors.length > 1;
  const authorNames = j.authors.length <= 2 ? j.authors.map((a) => a.displayName).join(' and ') : `${j.owner.displayName} and ${j.authors.length - 1} others`;
  const writes = j.viewer.isOwner || j.viewer.isMember;
  const statusColor = j.status === 'active' ? colors.ok : j.status === 'completed' ? colors.done : colors.warn;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Photo uri={j.coverUrl} radius="none" style={{ height: 338, backgroundColor: colors.fill2 }} label={`Cover photo of ${j.title}`}>
          <LinearGradient colors={[withAlpha(colors.black, 0.38), withAlpha(colors.black, 0)]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }} />
        </Photo>
        <View style={{ marginTop: -30, paddingTop: 52, paddingHorizontal: 22, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.bg, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${j.owner.displayName}'s profile`}
            onPress={openOwner}
            style={{ position: 'absolute', top: -38, borderRadius: radius.pill, borderWidth: 4, borderColor: colors.bg, boxShadow: shadow.float }}>
            <Avatar uri={j.owner.avatarUrl} name={j.owner.displayName} size={76} />
          </Pressable>
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
            <Pressable accessibilityRole="button" accessibilityLabel={`Shared journey. ${authorNames}. See the people`} onPress={() => router.push(`/journey/${j.id}/people`)} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
              <View style={{ flexDirection: 'row' }}>
                {j.authors.slice(0, 4).map((author, index) => (
                  <View key={author.id} style={{ marginLeft: index === 0 ? 0 : -8, borderRadius: radius.thumb, borderWidth: 2, borderColor: colors.bg }}>
                    <Avatar uri={author.avatarUrl} name={author.displayName} size={24} />
                  </View>
                ))}
              </View>
              <Pill label="Shared journey" style={{ backgroundColor: colors.fill }} />
            </Pressable>
          ) : null}

          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 18, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
            <Stat value={j.progressLabel} label={STATUS[j.status]} dot={statusColor} />
            <Stat value={String(j.entryCount)} label={j.entryCount === 1 ? 'entry' : 'entries'} divider />
            <Stat value={compact(j.followerCount)} label="following" divider />
          </View>

          {j.status === 'paused' ? (
            <View style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 12, marginTop: 18, padding: 14, borderRadius: radius.photo, backgroundColor: colors.fill }}>
              <Pause size={20} color={colors.warn} />
              <View style={{ flex: 1 }}>
                <Txt variant="control" weight={800}>
                  This journey is paused
                </Txt>
                <Txt variant="note">
                  {writes ? "Followers can still read it. Add an entry whenever you're ready and it picks up again." : `You can still read it. You'll hear when ${first} picks it up again.`}
                </Txt>
              </View>
            </View>
          ) : null}

          {j.targetDays ? <ChallengeCard journey={j} entries={entries} /> : null}

          {j.status === 'completed' ? (
            <Button label="See the recap" variant="soft" block icon={(c) => <Sparkles size={18} color={c} />} onPress={() => router.push(`/journey/${j.id}/recap`)} style={{ marginTop: 18 }} />
          ) : null}

          {photos.length >= 3 ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`${plural(photos.length, 'photo')}. Open the story.`} onPress={openStory} style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 6, height: 206, marginTop: 18, borderRadius: radius.card, overflow: 'hidden' }}>
              <Photo uri={photos[0]} radius="none" style={{ flex: 1.25 }} />
              <View style={{ flex: 1, gap: 6 }}>
                <Photo uri={photos[1]} radius="none" style={{ flex: 1 }} />
                <Photo uri={photos[2]} radius="none" style={{ flex: 1 }}>
                  {photos.length > 3 ? (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim }}>
                      <Txt variant="subtitle" style={{ color: colors.onPhoto }}>
                        +{photos.length - 3}
                      </Txt>
                    </View>
                  ) : null}
                </Photo>
              </View>
            </Pressable>
          ) : null}

          <View style={{ alignSelf: 'stretch', gap: 18, marginTop: 18 }}>
            {timeline.isPending ? (
              <View style={{ height: 120 }}>
                <Loading />
              </View>
            ) : timeline.isError ? (
              <Txt color="muted" center>
                {messageFor(timeline.error)}
              </Txt>
            ) : entries.length === 0 ? (
              <Txt variant="bodySmall" color="muted" center style={{ marginVertical: 20 }}>
                {j.viewer.isOwner ? 'Your story starts with the first entry.' : j.viewer.isMember ? 'The story starts with the first entry. It could be yours.' : `${first} hasn't added an entry yet. Follow to hear about the first one.`}
              </Txt>
            ) : (
              <>
                {latest.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} onPress={() => router.push(`/entry/${entry.id}`)} />
                ))}
                <Button label={entries.length > 3 ? `Read all ${entries.length} entries` : 'Read the story'} variant="line" block icon={(c) => <BookOpen size={18} color={c} />} onPress={openStory} />
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

      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <RoundButton tone="photo" label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {j.shareUrl ? (
            <RoundButton
              tone="photo"
              label="Share this journey"
              icon={(c) => <Share2 size={19} color={c} />}
              onPress={() => {
                const url = j.shareUrl;
                if (!url) return;
                void shareLink(j.title, url).then((result) => {
                  if (result !== 'copied') return;
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2500);
                });
              }}
            />
          ) : null}
          <RoundButton tone="photo" label="Journey options" onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} />
        </View>
      </View>

      <GlassBar
        radius="sheet"
        style={{ position: 'absolute', left: 12, right: 12, bottom: Math.max(insets.bottom, 12) + 8 }}
        contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 20, paddingRight: 10 }}>
        <View style={{ flex: 1 }}>
          <Txt variant="item" numberOfLines={1} weight={800}>
            {j.viewer.isOwner ? 'Your journey' : j.viewer.isMember ? 'You write in this journey' : j.viewer.isFollowing ? `You follow ${first}'s journey` : `Follow ${first}'s journey`}
          </Txt>
          <Txt variant="footnote" numberOfLines={1} color="muted">
            {writes
              ? j.status === 'completed'
                ? 'Completed'
                : j.status === 'paused'
                  ? 'Paused. A new entry starts it again.'
                  : j.entryCount === 0
                    ? 'Add the first entry'
                    : `${plural(j.entryCount, 'entry', 'entries')} so far`
              : j.status === 'completed'
                ? 'This journey is completed'
                : 'New entries land on your Home'}
          </Txt>
        </View>
        {writes ? (
          j.viewer.canAddEntry ? (
            <Button label="Entry" inline icon={(c) => <Plus size={19} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add`)} />
          ) : null
        ) : (
          <FollowButton journey={j} size="md" />
        )}
      </GlassBar>

      {copied ? (
        <View accessibilityLiveRegion="polite" style={{ position: 'absolute', alignSelf: 'center', bottom: Math.max(insets.bottom, 12) + 96, paddingVertical: 11, paddingHorizontal: 16, borderRadius: radius.cardLarge, backgroundColor: colors.text }}>
          <Txt variant="note" weight={700} style={{ color: colors.bg }}>
            Link copied
          </Txt>
        </View>
      ) : null}

      {j.viewer.isOwner ? (
        <OwnerMenu journey={j} visible={menu} onClose={() => setMenu(false)} />
      ) : (
        <Sheet visible={menu} onClose={() => setMenu(false)} title={j.title}>
          {shared ? (
            <SheetRow
              first
              icon={(c) => <Users size={22} color={c} />}
              label="People on this journey"
              note={j.viewer.isMember ? 'See who writes here, or leave' : undefined}
              onPress={() => {
                setMenu(false);
                router.push(`/journey/${j.id}/people`);
              }}
            />
          ) : null}
          <SheetRow
            first={!shared}
            icon={(c) => <Flag size={22} color={c} />}
            label="Report this journey"
            onPress={() => {
              setMenu(false);
              setReporting(true);
            }}
          />
        </Sheet>
      )}
      <ReportSheet target={reporting ? { type: 'journey', id: j.id, word: 'journey' } : null} onClose={() => setReporting(false)} />
    </View>
  );
}

/** What the owner can do with a journey: pause it, start it again, or delete it (after confirming). */
function OwnerMenu({ journey, visible, onClose }: { journey: JourneyResponse; visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const refresh = useRefreshAll();
  const [confirming, setConfirming] = useState(false);
  const update = useUpdateJourney({ mutation: { onSuccess: async () => { await refresh(); close(); } } });
  const remove = useDeleteJourney({
    mutation: {
      onSuccess: async () => {
        close();
        router.dismissAll();
        await refresh();
      },
    },
  });
  const close = () => {
    setConfirming(false);
    onClose();
  };
  const failed = update.error ?? remove.error;

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={confirming ? 'Delete this journey?' : journey.title}
      subtitle={confirming ? `"${journey.title}" and its ${plural(journey.entryCount, 'entry', 'entries')} will be gone for good, for you and everyone following.` : undefined}>
      {failed ? (
        <Txt variant="caption" color="danger" style={{ paddingHorizontal: layout.gutter, paddingBottom: 8 }}>
          {messageFor(failed)}
        </Txt>
      ) : null}
      {confirming ? (
        <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button label="Delete journey" variant="danger" size="lg" block loading={remove.isPending} onPress={() => remove.mutate({ id: journey.id })} />
          <Button label="Keep it" variant="soft" size="lg" block onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <>
          {journey.status !== 'completed' ? (
            <SheetRow
              first
              icon={(c) => <Pencil size={22} color={c} />}
              label="Edit details"
              note="Title, cover, start date, who can see it"
              onPress={() => {
                close();
                router.push(`/journey/${journey.id}/edit`);
              }}
            />
          ) : null}
          <SheetRow
            first={journey.status === 'completed'}
            icon={(c) => <Users size={22} color={c} />}
            label="People on this journey"
            note={journey.status === 'completed' ? undefined : 'Invite friends to add their own entries'}
            onPress={() => {
              close();
              router.push(`/journey/${journey.id}/people`);
            }}
          />
          {journey.status !== 'completed' && journey.entryCount > 0 ? (
            <SheetRow
              icon={(c) => <CircleCheck size={22} color={c} />}
              label="Complete journey"
              note="Add a closing note and get the recap"
              onPress={() => {
                close();
                router.push(`/journey/${journey.id}/complete`);
              }}
            />
          ) : null}
          {journey.status === 'active' ? (
            <SheetRow icon={(c) => <Pause size={22} color={c} />} label="Pause journey" note="Followers see it's on hold. A new entry starts it again." onPress={() => update.mutate({ id: journey.id, data: { status: 'paused' } })} />
          ) : journey.status === 'paused' ? (
            <SheetRow icon={(c) => <Play size={22} color={c} />} label="Resume journey" onPress={() => update.mutate({ id: journey.id, data: { status: 'active' } })} />
          ) : null}
          <SheetRow danger icon={(c) => <Trash2 size={22} color={c} />} label="Delete journey" onPress={() => setConfirming(true)} />
        </>
      )}
    </Sheet>
  );
}
