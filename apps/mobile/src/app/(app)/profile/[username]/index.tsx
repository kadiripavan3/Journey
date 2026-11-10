import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Ban, Ellipsis, Flag, Link as LinkIcon } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetJourneysByUsername, useGetProfile, useUnblockProfile } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { FollowButton } from '@/features/journeys/FollowButton';
import { JourneyRow } from '@/features/journeys/JourneyRow';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { BlockSheet, ReportSheet } from '@/features/safety/SafetySheets';
import { firstName } from '@/lib/names';
import { compact, followersLabel } from '@/lib/plural';
import { layout, radius, useTheme, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Loading } from '@/ui/Loading';
import { Photo } from '@/ui/Photo';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Stat } from '@/ui/Stat';
import { Txt } from '@/ui/Txt';
import { WordTabs } from '@/ui/WordTabs';

/** 9.2 Creator profile: someone else's shelf of journeys. Following them also brings their next journeys; or follow just one from the list. */
export default function CreatorProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, shadow } = useTheme();
  const profile = useGetProfile(username);
  const journeys = useGetJourneysByUsername(username);
  const [shelf, setShelf] = useState<'active' | 'completed'>('active');
  const [menu, setMenu] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reporting, setReporting] = useState(false);
  const refresh = useRefreshAll();
  const unblock = useUnblockProfile({ mutation: { onSuccess: () => refresh() } });

  if (profile.isPending || profile.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: layout.barGutter, paddingTop: 8 }}>
          <RoundButton label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
        {profile.isPending ? <Loading /> : <Problem message={messageFor(profile.error)} onRetry={() => void profile.refetch()} retrying={profile.isRefetching} />}
      </View>
    );
  }

  const p = profile.data;
  const all = journeys.data ?? [];
  const active = all.filter((j) => j.status !== 'completed');
  const completed = all.filter((j) => j.status === 'completed');
  const shown = shelf === 'active' ? active : completed;
  const first = firstName(p.displayName);
  const cover = (active[0] ?? completed[0])?.coverUrl;
  const openPeople = (tab: 'followers' | 'following') => router.push(`/profile/${p.username}/people?tab=${tab}`);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
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
            {p.viewer.followsYou ? <Txt variant="caption" color="muted" weight={500}>{' · Follows you'}</Txt> : null}
          </Txt>
          {p.bio ? (
            <Txt variant="body" color="muted" center style={{ marginTop: 10, marginHorizontal: 30 }}>
              {p.bio}
            </Txt>
          ) : null}
          {p.link ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <LinkIcon size={15} color={colors.accentText} />
              <Txt variant="callout" numberOfLines={1} weight={700} style={{ color: colors.accentText }}>
                {p.link.replace(/^https?:\/\//, '')}
              </Txt>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 18, marginHorizontal: 22, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
            <Stat value={compact(p.journeyCount)} spoken={p.journeyCount} label={p.journeyCount === 1 ? 'journey' : 'journeys'} />
            <Stat value={compact(p.followerCount)} spoken={p.followerCount} label={p.followerCount === 1 ? 'follower' : 'followers'} divider onPress={() => openPeople('followers')} />
            <Stat value={compact(p.entryCount)} spoken={p.entryCount} label={p.entryCount === 1 ? 'entry' : 'entries'} divider />
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: 16, marginHorizontal: layout.gutter, gap: 8 }}>
            {p.viewer.isMe ? (
              <Button label="Edit profile" variant="soft" block onPress={() => router.push('/edit-profile')} />
            ) : p.viewer.hasBlocked ? (
              <>
                <Button label="Unblock" variant="line" block loading={unblock.isPending} onPress={() => unblock.mutate({ username: p.username })} />
                <Txt variant="small" weight={500} color="muted" center>
                  You&apos;ve blocked {first}. Neither of you sees the other&apos;s journeys.
                </Txt>
              </>
            ) : (
              <>
                <PersonFollowButton username={p.username} isFollowing={p.viewer.isFollowing} followsYou={p.viewer.followsYou} name={first} size="md" block />
                <Txt variant="small" weight={500} color="muted" center>
                  {p.viewer.isFollowing ? `You'll get ${first}'s next journeys.` : `Following ${first} also brings their next journeys.`}
                </Txt>
              </>
            )}
          </View>

          <WordTabs
            tabs={[
              { id: 'active', label: 'Active', count: active.length },
              { id: 'completed', label: 'Completed', count: completed.length },
            ]}
            value={shelf}
            onChange={setShelf}
            style={{ alignSelf: 'stretch', marginTop: 10, paddingHorizontal: layout.gutter }}
          />

          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            {journeys.isPending ? (
              <View style={{ height: 140 }}>
                <Loading />
              </View>
            ) : journeys.isError ? (
              <View style={{ height: 220 }}>
                <Problem message={messageFor(journeys.error)} onRetry={() => void journeys.refetch()} retrying={journeys.isRefetching} />
              </View>
            ) : shown.length === 0 ? (
              <Txt variant="bodySmall" color="muted" center style={{ marginTop: 30, marginHorizontal: 40 }}>
                {shelf === 'active' ? `${first} has no journeys in progress.` : `${first} hasn't completed a journey yet.`}
              </Txt>
            ) : (
              shown.map((journey) => (
                <JourneyRow
                  key={journey.id}
                  coverUrl={journey.coverUrl}
                  title={journey.title}
                  detail={`${journey.status === 'paused' ? 'Paused · ' : ''}${journey.progressLabel} · ${followersLabel(journey.followerCount)}`}
                  onPress={() => router.push(`/journey/${journey.id}`)}
                  trailing={<FollowButton journey={journey} />}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
        <RoundButton tone="photo" label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        {p.viewer.isMe ? null : <RoundButton tone="photo" label="More options" onPress={() => setMenu(true)} icon={(c) => <Ellipsis size={20} color={c} />} />}
      </View>

      <Sheet visible={menu} onClose={() => setMenu(false)} title={p.displayName}>
        {p.viewer.hasBlocked ? null : (
          <SheetRow
            first
            icon={(c) => <Ban size={22} color={c} />}
            label={`Block ${first}`}
            onPress={() => {
              setMenu(false);
              setBlocking(true);
            }}
          />
        )}
        <SheetRow
          first={p.viewer.hasBlocked}
          icon={(c) => <Flag size={22} color={c} />}
          label={`Report ${first}`}
          onPress={() => {
            setMenu(false);
            setReporting(true);
          }}
        />
      </Sheet>
      <BlockSheet person={blocking ? p : null} onClose={() => setBlocking(false)} onBlocked={() => router.back()} />
      <ReportSheet target={reporting ? { type: 'profile', id: p.id, word: 'person' } : null} onClose={() => setReporting(false)} />
    </View>
  );
}
