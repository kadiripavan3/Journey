import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetBlocked, useUnblockProfile } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { timeAgo } from '@/lib/dates';
import { useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Loading, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Txt';

/** 10.7 Blocked accounts: who you've blocked, and a way to undo it. */
export default function Blocked() {
  const { colors } = useTheme();
  const refresh = useRefreshAll();
  const blocked = useGetBlocked();
  const unblock = useUnblockProfile({ mutation: { onSuccess: () => refresh() } });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Blocked accounts" trailing={<View style={{ width: 40 }} />} />
      <Txt color="muted" style={{ fontSize: 15, lineHeight: 22, marginTop: 6, marginHorizontal: 20 }}>
        Blocked people can&apos;t see, follow or comment on your journeys, and you won&apos;t see theirs. They aren&apos;t told.
      </Txt>
      {unblock.isError ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: 20 }}>
          {messageFor(unblock.error)}
        </Txt>
      ) : null}
      {blocked.isPending ? (
        <Loading />
      ) : blocked.isError ? (
        <Problem error={blocked.error} onRetry={() => void blocked.refetch()} retrying={blocked.isRefetching} />
      ) : blocked.data.length === 0 ? (
        <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22, marginTop: 60, marginHorizontal: 40 }}>
          You haven&apos;t blocked anyone.
        </Txt>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {blocked.data.map((person) => (
            <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 20 }}>
              <Avatar uri={person.avatarUrl} name={person.displayName} size={48} />
              <View style={{ flex: 1 }}>
                <Txt numberOfLines={1} weight={700} style={{ fontSize: 15, lineHeight: 20 }}>
                  {person.displayName}
                </Txt>
                <Txt numberOfLines={1} color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
                  @{person.username} · blocked {timeAgo(person.blockedAt)}
                </Txt>
              </View>
              <Button label="Unblock" inline size="sm" variant="line" onPress={() => unblock.mutate({ username: person.username })} />
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
