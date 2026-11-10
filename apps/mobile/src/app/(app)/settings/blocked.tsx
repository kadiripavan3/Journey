import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetBlocked, useUnblockProfile } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { timeAgo } from '@/lib/dates';
import { layout, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
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
      <Txt variant="body" color="muted" style={{ marginTop: 6, marginHorizontal: layout.rowGutter }}>
        Blocked people can&apos;t see, follow or comment on your journeys, and you won&apos;t see theirs. They aren&apos;t told.
      </Txt>
      {unblock.isError ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: layout.rowGutter }}>
          {messageFor(unblock.error)}
        </Txt>
      ) : null}
      {blocked.isPending ? (
        <Loading />
      ) : blocked.isError ? (
        <Problem message={messageFor(blocked.error)} onRetry={() => void blocked.refetch()} retrying={blocked.isRefetching} />
      ) : blocked.data.length === 0 ? (
        <Txt variant="bodySmall" color="muted" center style={{ marginTop: 60, marginHorizontal: 40 }}>
          You haven&apos;t blocked anyone.
        </Txt>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {blocked.data.map((person) => (
            <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: layout.rowGutter }}>
              <Avatar uri={person.avatarUrl} name={person.displayName} size={48} />
              <View style={{ flex: 1 }}>
                <Txt variant="item" numberOfLines={1}>
                  {person.displayName}
                </Txt>
                <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
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
