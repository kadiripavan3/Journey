import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, Link as LinkIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useGetJourneysByUsername, useGetProfile } from '@/api/generated/journey';
import { compact, followersLabel } from '@/lib/plural';
import { useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { JourneyRow, Loading, Photo, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { FollowButton } from '@/ui/FollowButton';
import { PersonFollowButton } from '@/ui/PersonFollowButton';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

/** 9.2 Creator profile: someone else's shelf of journeys. Following them also brings their next journeys; or follow just one from the list. */
export default function CreatorProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const profile = useGetProfile(username);
  const journeys = useGetJourneysByUsername(username);
  const [shelf, setShelf] = useState<'active' | 'completed'>('active');

  if (profile.isPending || profile.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <RoundButton label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
        {profile.isPending ? <Loading /> : <Problem error={profile.error} onRetry={() => void profile.refetch()} retrying={profile.isRefetching} />}
      </View>
    );
  }

  const p = profile.data;
  const all = journeys.data ?? [];
  const active = all.filter((j) => j.status !== 'completed');
  const completed = all.filter((j) => j.status === 'completed');
  const shown = shelf === 'active' ? active : completed;
  const firstName = p.displayName.trim().split(/\s+/)[0];
  const cover = (active[0] ?? completed[0])?.coverUrl;
  const openPeople = (tab: 'followers' | 'following') => router.push(`/profile/${p.username}/people?tab=${tab}` as never);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Photo uri={cover} radius={0} style={{ height: 230, backgroundColor: colors.fill2 }}>
          <LinearGradient colors={['rgba(0,0,0,0.38)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 130 }} />
        </Photo>
        <View style={{ marginTop: -30, paddingTop: 52, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: colors.bg, alignItems: 'center' }}>
          <View style={{ position: 'absolute', top: -38, borderRadius: 42, borderWidth: 4, borderColor: colors.bg, boxShadow: '0 6px 16px rgba(0, 0, 0, 0.16)' }}>
            <Avatar uri={p.avatarUrl} name={p.displayName} size={76} />
          </View>
          <Txt accessibilityRole="header" weight={800} center style={{ fontSize: 27, lineHeight: 30, letterSpacing: -0.95, marginHorizontal: 22 }}>
            {p.displayName}
          </Txt>
          <Txt center weight={700} style={{ fontSize: 13, lineHeight: 18, marginTop: 8 }}>
            @{p.username}
            {p.viewer.followsYou ? <Txt color="muted" weight={500} style={{ fontSize: 13, lineHeight: 18 }}>{' · Follows you'}</Txt> : null}
          </Txt>
          {p.bio ? (
            <Txt color="muted" center style={{ fontSize: 15, lineHeight: 22, marginTop: 10, marginHorizontal: 30 }}>
              {p.bio}
            </Txt>
          ) : null}
          {p.link ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <LinkIcon size={15} color={colors.accentText} />
              <Txt numberOfLines={1} weight={700} style={{ fontSize: 14, lineHeight: 20, color: colors.accentText }}>
                {p.link.replace(/^https?:\/\//, '')}
              </Txt>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', alignSelf: 'stretch', marginTop: 18, marginHorizontal: 22, paddingVertical: 13, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line }}>
            <Stat value={p.journeyCount} label={p.journeyCount === 1 ? 'journey' : 'journeys'} />
            <Stat value={p.followerCount} label={p.followerCount === 1 ? 'follower' : 'followers'} divider onPress={() => openPeople('followers')} />
            <Stat value={p.entryCount} label={p.entryCount === 1 ? 'entry' : 'entries'} divider />
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: 16, marginHorizontal: 22, gap: 8 }}>
            {p.viewer.isMe ? (
              <Button label="Edit profile" variant="soft" block onPress={() => router.push('/edit-profile' as never)} />
            ) : (
              <>
                <PersonFollowButton username={p.username} isFollowing={p.viewer.isFollowing} followsYou={p.viewer.followsYou} name={firstName} size="md" block />
                <Txt color="muted" center style={{ fontSize: 12, lineHeight: 17 }}>
                  {p.viewer.isFollowing ? `You'll get ${firstName}'s next journeys.` : `Following ${firstName} also brings their next journeys.`}
                </Txt>
              </>
            )}
          </View>

          <View accessibilityRole="tablist" style={{ alignSelf: 'stretch', flexDirection: 'row', gap: 24, marginTop: 10, paddingHorizontal: 22, borderBottomWidth: 1, borderBottomColor: colors.line }}>
            <ShelfTab label="Active" count={active.length} on={shelf === 'active'} onPress={() => setShelf('active')} />
            <ShelfTab label="Completed" count={completed.length} on={shelf === 'completed'} onPress={() => setShelf('completed')} />
          </View>

          <View style={{ alignSelf: 'stretch', marginTop: 8 }}>
            {journeys.isPending ? (
              <View style={{ height: 140 }}>
                <Loading />
              </View>
            ) : journeys.isError ? (
              <View style={{ height: 220 }}>
                <Problem error={journeys.error} onRetry={() => void journeys.refetch()} retrying={journeys.isRefetching} />
              </View>
            ) : shown.length === 0 ? (
              <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22, marginTop: 30, marginHorizontal: 40 }}>
                {shelf === 'active' ? `${firstName} has no journeys in progress.` : `${firstName} hasn't completed a journey yet.`}
              </Txt>
            ) : (
              shown.map((journey) => (
                <JourneyRow
                  key={journey.id}
                  coverUrl={journey.coverUrl}
                  title={journey.title}
                  detail={`${journey.status === 'paused' ? 'Paused · ' : ''}${journey.progressLabel} · ${followersLabel(journey.followerCount)}`}
                  onPress={() => router.push(`/journey/${journey.id}` as never)}
                  trailing={<FollowButton journey={journey} />}
                />
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <View style={{ position: 'absolute', top: insets.top + 8, left: 16 }}>
        <RoundButton tone="photo" label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
      </View>
    </View>
  );
}

function Stat({ value, label, divider, onPress }: { value: number; label: string; divider?: boolean; onPress?: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${value} ${label}`}
      disabled={!onPress}
      onPress={onPress}
      style={{ flex: 1, alignItems: 'center', borderLeftWidth: divider ? 1 : 0, borderLeftColor: colors.line }}>
      <Txt weight={800} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.35 }}>
        {compact(value)}
      </Txt>
      <Txt color="muted" weight={600} style={{ fontSize: 12, lineHeight: 16 }}>
        {label}
      </Txt>
    </Pressable>
  );
}

function ShelfTab({ label, count, on, onPress }: { label: string; count: number; on: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const color = on ? colors.text : colors.muted;
  return (
    <Pressable accessibilityRole="tab" accessibilityLabel={`${label}, ${count}`} accessibilityState={{ selected: on }} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 12 }}>
      <Txt weight={700} style={{ fontSize: 15, lineHeight: 20, color }}>
        {label}
      </Txt>
      <Txt weight={600} style={{ fontSize: 12.5, lineHeight: 17, color }}>
        {count}
      </Txt>
      {on ? <View style={{ position: 'absolute', left: 0, right: 0, bottom: -1, height: 2.5, borderRadius: 2, backgroundColor: colors.text }} /> : null}
    </Pressable>
  );
}
