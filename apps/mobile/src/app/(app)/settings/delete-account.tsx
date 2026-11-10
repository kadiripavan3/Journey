import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Trash2 } from 'lucide-react-native';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useDeleteAccount, useGetMe, useGetProfile } from '@/api/generated/journey';
import { useSession } from '@/auth/session';
import { compact, plural } from '@/lib/plural';
import { radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 10.6 Delete account: clear and final. No maze and no guilt trip. */
export default function DeleteAccount() {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useSession();
  const queryClient = useQueryClient();
  const profile = useGetMe().data?.profile;
  const counts = useGetProfile(profile?.username ?? '', { query: { enabled: !!profile } }).data;
  const remove = useDeleteAccount({
    mutation: {
      onSuccess: async () => {
        await session.signOut();
        queryClient.clear();
      },
    },
  });

  const losses = counts
    ? [
        `Your ${plural(counts.journeyCount, 'journey')} and ${plural(counts.entryCount, 'entry', 'entries')}, with their photos`,
        `Your ${compact(counts.followerCount)} ${counts.followerCount === 1 ? 'follower' : 'followers'} and the ${plural(counts.followingCount, 'person', 'people')} you follow`,
        'Your likes and comments',
      ]
    : [];

  return (
    <Screen
      header={<AppBar />}
      footer={
        <>
          {remove.isError ? (
            <Txt variant="caption" color="danger" center accessibilityLiveRegion="polite">
              {messageFor(remove.error)}
            </Txt>
          ) : null}
          <Button label="Delete my account" variant="danger" size="lg" block loading={remove.isPending} onPress={() => remove.mutate()} />
          <Button label="Keep my account" variant="line" size="lg" block onPress={() => router.back()} />
        </>
      }>
      <View style={{ width: 72, height: 72, borderRadius: radius.cardLarge, marginTop: 14, marginBottom: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>
        <Trash2 size={32} color={colors.danger} />
      </View>
      <Heading>Delete your account?</Heading>
      <Lead>This can&apos;t be undone. Everyone will stop seeing your profile, and you&apos;ll lose:</Lead>
      <View style={{ gap: 10, marginTop: 18 }}>
        {losses.map((loss) => (
          <View key={loss} style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ width: 6, height: 6, borderRadius: radius.pill, marginTop: 8, backgroundColor: colors.text }} />
            <Txt variant="body" weight={600} style={{ flex: 1 }}>
              {loss}
            </Txt>
          </View>
        ))}
      </View>
    </Screen>
  );
}
