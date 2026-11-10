import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Check, X } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useAcceptInvitation, useGetInvitationsInfinite, useGetMe, useRemoveMember } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { paged, rows } from '@/api/pages';
import { plural } from '@/lib/plural';
import { darkTheme, layout, withAlpha } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

const STAGE = darkTheme.colors.stage;
const ON = darkTheme.colors.onPhoto;
const WHO = { public: "It's public", unlisted: 'Only people with the link see it', private: 'Only its authors see it' } as const;

/** 8.2 Invitation: what the friend sees. It says plainly what joining means. Nobody is added without saying yes. */
export default function Invitation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const cache = useCache();
  const me = useGetMe().data?.profile;
  const invitations = useGetInvitationsInfinite({ limit: 100 }, { query: paged });
  const invitation = rows(invitations.data)?.find((i) => i.journey.id === id);
  const accept = useAcceptInvitation({
    mutation: {
      onSuccess: async () => {
        await cache.membersChanged(id);
        router.replace(`/journey/${id}`);
      },
    },
  });
  const decline = useRemoveMember({
    mutation: {
      onSuccess: async () => {
        router.back();
        await cache.membersChanged(id);
      },
    },
  });
  const failed = accept.error ?? decline.error;
  const j = invitation?.journey;
  const points = j
    ? [
        'Post your own entries and photos',
        'It shows on your profile as a shared journey',
        j.visibility === 'public' && j.followerCount > 0 ? `${WHO.public}, and ${plural(j.followerCount, 'person follows', 'people follow')} it` : WHO[j.visibility],
        'Leave whenever you like',
      ]
    : [];

  return (
    <View style={{ flex: 1, backgroundColor: STAGE }}>
      <StatusBar style="light" />
      {j?.coverUrl ? <Image source={{ uri: j.coverUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} /> : null}
      <LinearGradient colors={[withAlpha(STAGE, 0.45), withAlpha(STAGE, 0.05), withAlpha(STAGE, 0.8), withAlpha(STAGE, 0.96)]} locations={[0, 0.25, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: layout.rowGutter }}>
        <View style={{ paddingTop: 8, marginLeft: -4 }}>
          <RoundButton tone="photo" label="Close" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
        </View>
        {invitations.isPending ? (
          <Loading />
        ) : invitations.isError ? (
          <Problem message={messageFor(invitations.error)} onRetry={() => void invitations.refetch()} retrying={invitations.isRefetching} />
        ) : !invitation || !j ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <Txt variant="body" center style={{ color: ON }}>
              This invitation isn&apos;t there any more.
            </Txt>
          </View>
        ) : (
          <View style={{ gap: 12, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar uri={invitation.invitedBy.avatarUrl} name={invitation.invitedBy.displayName} size={36} />
              <Txt variant="item" style={{ color: ON }}>
                {invitation.invitedBy.displayName} invited you
              </Txt>
            </View>
            <Txt variant="display" accessibilityRole="header" style={{ color: ON }}>
              Add to {j.title}?
            </Txt>
            <View style={{ gap: 9, marginVertical: 6 }}>
              {points.map((point) => (
                <View key={point} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Check size={18} color={darkTheme.colors.accent} strokeWidth={2.6} />
                  <Txt variant="body" style={{ flex: 1, color: ON, opacity: 0.9 }}>{point}</Txt>
                </View>
              ))}
            </View>
            {failed ? (
              <Txt variant="caption" accessibilityLiveRegion="polite" style={{ color: darkTheme.colors.danger }}>
                {messageFor(failed)}
              </Txt>
            ) : null}
            <Button label="Join the journey" size="lg" block loading={accept.isPending} onPress={() => accept.mutate({ id })} />
            <Button label="Not now" size="lg" variant="glass" block loading={decline.isPending} onPress={() => me && decline.mutate({ id, username: me.username })} />
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
