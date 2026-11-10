import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Ban, Ellipsis, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetJourneysByUsernameInfinite, useGetProfile, useUnblockProfile } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { paged, rows, useEveryPage } from '@/api/pages';
import { FollowButton } from '@/features/journeys/FollowButton';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { ProfileLink } from '@/features/people/ProfileLink';
import { BlockSheet, ReportSheet } from '@/features/safety/SafetySheets';
import { useLeave } from '@/features/navigation/useLeave';
import { PageProblem } from '@/features/states/PageProblem';
import { wentAway } from '@/lib/loading';
import { firstName } from '@/lib/names';
import { compact } from '@/lib/compact';
import { followersLabel } from '@/lib/following';
import { layout, radius, useTheme, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { LightStatusBar } from '@/ui/LightStatusBar';
import { Loading } from '@/ui/Loading';
import { Photo } from '@/ui/Photo';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { HeroSkeleton } from '@/ui/Skeleton';
import { Stat } from '@/ui/Stat';
import { Txt } from '@/ui/Txt';
import { WordTabs } from '@/ui/WordTabs';
import { words } from '@/words';

/** 9.2 Creator profile: someone else's shelf of journeys. Following them also brings their next journeys; or follow just one from the list. */
export default function CreatorProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const leave = useLeave();
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const profile = useGetProfile(username);
  // A profile sorts its journeys into shelves, so it reads all of them; the list is short by nature.
  const journeys = useGetJourneysByUsernameInfinite(username, { limit: 100 }, { query: paged });
  useEveryPage(journeys);
  const [shelf, setShelf] = useState<'active' | 'completed'>('active');
  const [menu, setMenu] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reporting, setReporting] = useState(false);
  const cache = useCache();
  const unblock = useUnblockProfile({ mutation: { onSuccess: () => cache.blockChanged() } });

  const p = profile.data;
  if (!p || wentAway(profile)) {
    // Not here yet, or not at all: the way back stays, on the page's own colours.
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {profile.isError ? (
          <View style={{ flex: 1, paddingTop: insets.top + 56 }}>
            <PageProblem error={profile.error} onRetry={() => void profile.refetch()} retrying={profile.isFetching} />
          </View>
        ) : profile.isPaused ? (
          <Loading offline />
        ) : (
          <HeroSkeleton photo={230} />
        )}
        <View style={{ position: 'absolute', top: insets.top + 8, left: layout.barGutter }}>
          <RoundButton label={words.common.back} onPress={leave} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
      </View>
    );
  }

  const all = rows(journeys.data) ?? [];
  const active = all.filter((j) => j.status !== 'completed');
  const completed = all.filter((j) => j.status === 'completed');
  const shown = shelf === 'active' ? active : completed;
  const first = firstName(p.displayName);
  const cover = (active[0] ?? completed[0])?.coverUrl;
  const openPeople = (tab: 'followers' | 'following') => router.push(`/profile/${p.username}/people?tab=${tab}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LightStatusBar />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Photo uri={cover} radius="none" style={{ height: 230, backgroundColor: colors.fill2 }}>
          <LinearGradient colors={[withAlpha(colors.black, 0.38), withAlpha(colors.black, 0)]} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }} />
        </Photo>
        <View style={{ marginTop: -30, paddingTop: 52, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.bg, alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: -38, borderRadius: radius.pill, borderWidth: 4, borderColor: colors.bg, boxShadow: shadow.float }}>
            <Avatar uri={p.avatarUrl} name={p.displayName} size={76} />
          </View>
          <Txt variant="titleLarge" accessibilityRole="header" center style={{ marginHorizontal: layout.gutter }}>
            {p.displayName}
          </Txt>
          <Txt variant="caption" center weight={700} style={{ marginTop: 8 }}>
            @{p.username}
            {p.viewer.followsYou ? <Txt variant="caption" color="muted" weight={500}>{words.common.also(words.profile.page.followsYou)}</Txt> : null}
          </Txt>
          {p.bio ? (
            <Txt variant="body" color="muted" center style={{ marginTop: 10, marginHorizontal: 30 }}>
              {p.bio}
            </Txt>
          ) : null}
          {p.link ? <ProfileLink url={p.link} style={{ alignSelf: 'center', marginTop: 8, marginHorizontal: layout.gutter }} /> : null}

          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 18, marginHorizontal: layout.gutter, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
            <Stat value={compact(p.journeyCount)} spoken={p.journeyCount} label={words.common.unit.journeys(p.journeyCount)} />
            <Stat value={compact(p.followerCount)} spoken={p.followerCount} label={words.common.unit.followers(p.followerCount)} divider onPress={() => openPeople('followers')} />
            <Stat value={compact(p.entryCount)} spoken={p.entryCount} label={words.common.unit.entries(p.entryCount)} divider />
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: 16, marginHorizontal: layout.gutter, gap: 8 }}>
            {p.viewer.isMe ? (
              <Button label={words.profile.you.edit} variant="soft" block onPress={() => router.push('/edit-profile')} />
            ) : p.viewer.hasBlocked ? (
              <>
                <Button label={words.people.unblock} variant="line" block loading={unblock.isPending} onPress={() => unblock.mutate({ username: p.username })} />
                <Txt variant="small" weight={500} color="muted" center>
                  {words.profile.page.blocked(first)}
                </Txt>
              </>
            ) : (
              <>
                <PersonFollowButton username={p.username} isFollowing={p.viewer.isFollowing} followsYou={p.viewer.followsYou} name={first} size="md" block />
                <Txt variant="small" weight={500} color="muted" center>
                  {p.viewer.isFollowing ? words.profile.page.following(first) : words.profile.page.notFollowing(first)}
                </Txt>
              </>
            )}
          </View>

          <WordTabs
            tabs={[
              { id: 'active', label: words.profile.shelves.active, count: active.length },
              { id: 'completed', label: words.profile.shelves.completed, count: completed.length },
            ]}
            value={shelf}
            onChange={setShelf}
            style={{ alignSelf: 'stretch', marginTop: 10, paddingHorizontal: layout.gutter }}
          />

          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            {journeys.isPending ? (
              <View style={{ height: 140 }}>
                <Loading offline={journeys.isPaused} />
              </View>
            ) : journeys.isError && !journeys.data ? (
              <View style={{ height: 220 }}>
                <Problem message={messageFor(journeys.error)} onRetry={() => void journeys.refetch()} retrying={journeys.isFetching} />
              </View>
            ) : shown.length === 0 ? (
              <Txt variant="bodySmall" color="muted" center style={{ marginTop: 30, marginHorizontal: 40 }}>
                {words.profile.page.emptyShelf[shelf](first)}
              </Txt>
            ) : (
              shown.map((journey) => (
                <JourneyRow
                  key={journey.id}
                  coverUrl={journey.coverThumbUrl}
                  title={journey.title}
                  badge={journey.authors.length > 1 ? words.journeys.card.shared : undefined}
                  detail={words.common.join([journey.status === 'paused' ? words.journeys.status.paused : null, journey.progressLabel, followersLabel(journey.followerCount)])}
                  onPress={() => router.push(`/journey/${journey.id}`)}
                  trailing={<FollowButton journey={journey} />}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: layout.barGutter, right: layout.barGutter, flexDirection: 'row', justifyContent: 'space-between' }}>
        <RoundButton tone="photo" label={words.common.back} onPress={leave} icon={(c) => <ArrowLeft size={20} color={c} />} />
        {p.viewer.isMe ? null : <RoundButton tone="photo" label={words.profile.page.more} onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} />}
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={p.displayName}>
        {p.viewer.hasBlocked ? null : (
          <SheetRow
            first
            icon={(c) => <Ban size={22} color={c} />}
            label={words.profile.page.block(first)}
            onPress={() => {
              setMenu(false);
              setBlocking(true);
            }}
          />
        )}
        <SheetRow
          first={p.viewer.hasBlocked}
          icon={(c) => <Flag size={22} color={c} />}
          label={words.profile.page.report(first)}
          onPress={() => {
            setMenu(false);
            setReporting(true);
          }}
        />
      </Sheet>
      <BlockSheet person={blocking ? p : null} onClose={() => setBlocking(false)} onBlocked={leave} />
      <ReportSheet target={reporting ? { type: 'profile', id: p.id } : null} onClose={() => setReporting(false)} />
    </View>
  );
}
