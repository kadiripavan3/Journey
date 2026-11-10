import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { useGetBlockedInfinite, useUnblockProfile } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { paged, rows } from '@/api/pages';
import { PersonRow } from '@/features/people/PersonRow';
import { PageProblem } from '@/features/states/PageProblem';
import { MoreButton } from '@/ui/MoreButton';
import { timeAgo } from '@/lib/dates';
import { layout, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Loading } from '@/ui/Loading';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/** 10.7 Blocked accounts: who you've blocked, and a way to undo it. */
export default function Blocked() {
  const { colors } = useTheme();
  const cache = useCache();
  const blocked = useGetBlockedInfinite(undefined, { query: paged });
  const people = rows(blocked.data) ?? [];
  const unblock = useUnblockProfile({ mutation: { onSuccess: () => cache.blockChanged() } });

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title={words.settings.blocked.title} trailing={<View style={{ width: 40 }} />} />
      <Txt variant="body" color="muted" style={{ marginTop: 6, marginHorizontal: layout.rowGutter }}>
        {words.settings.blocked.lead}
      </Txt>
      {unblock.isError ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: layout.rowGutter }}>
          {messageFor(unblock.error)}
        </Txt>
      ) : null}
      {!blocked.data ? (
        blocked.isError ? <PageProblem error={blocked.error} onRetry={() => void blocked.refetch()} retrying={blocked.isFetching} /> : <Loading offline={blocked.isPaused} />
      ) : people.length === 0 ? (
        <Txt variant="bodySmall" color="muted" center style={{ marginTop: 60, marginHorizontal: 40 }}>
          {words.settings.blocked.none}
        </Txt>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {people.map((person) => (
            <PersonRow
              key={person.id}
              person={person}
              detail={words.common.join([`@${person.username}`, words.settings.blocked.since(timeAgo(person.blockedAt))])}
              trailing={<Button label={words.settings.blocked.unblock} inline size="sm" variant="line" onPress={() => unblock.mutate({ username: person.username })} />}
            />
          ))}
          <MoreButton pages={blocked} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
