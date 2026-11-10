import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type MemberResponse, useGetInvitable, useGetJourney, useGetMe, useGetMembers, useInviteMember, useRemoveMember } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { timeAgo } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Card, Loading, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { GroupLabel } from '@/ui/Heading';
import { Txt } from '@/ui/Txt';

const RULES = [
  { what: 'Add entries', note: 'And edit or delete their own', who: 'Everyone' },
  { what: 'Change the journey', note: 'Title, cover, who sees it, completing it', who: 'Only the owner' },
  { what: 'Remove people or entries', note: '', who: 'Only the owner' },
];

/** 8.1 and 8.6 People on a journey: who can add entries, who is still deciding, and (for the owner) who to invite. */
export default function JourneyPeople() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const refresh = useRefreshAll();
  const myId = useGetMe().data?.id;
  const journey = useGetJourney(id);
  const members = useGetMembers(id);
  const isOwner = members.data?.viewerRole === 'owner';
  const invitable = useGetInvitable(id, { query: { enabled: isOwner } });
  const invite = useInviteMember({ mutation: { onSuccess: () => refresh() } });
  const remove = useRemoveMember({
    mutation: {
      onSuccess: async (_, { username }) => {
        const left = members.data?.members.find((m) => m.person.username === username)?.person.id === myId;
        await refresh();
        if (left) router.back();
      },
    },
  });
  const failed = invite.error ?? remove.error;
  const data = members.data;
  const joined = (data?.members ?? []).filter((m) => m.status === 'joined');
  const waiting = (data?.members ?? []).filter((m) => m.status === 'invited');

  const row = (member: MemberResponse) => {
    const me = member.person.id === myId;
    const detail =
      member.status === 'invited'
        ? `Invited ${timeAgo(member.since)}`
        : member.role === 'owner'
          ? `${me ? 'You · ' : ''}${plural(member.entryCount, 'entry', 'entries')}`
          : `${me ? 'You · ' : ''}Can add entries · ${member.entryCount} so far`;
    const action =
      member.role === 'owner' ? (
        <Txt color="muted" weight={700} style={{ fontSize: 13, lineHeight: 18 }}>
          Owner
        </Txt>
      ) : isOwner ? (
        <Button label={member.status === 'invited' ? 'Cancel' : 'Remove'} inline size="sm" variant="line" onPress={() => remove.mutate({ id, username: member.person.username })} />
      ) : me ? (
        <Button label="Leave" inline size="sm" variant="line" onPress={() => remove.mutate({ id, username: member.person.username })} />
      ) : null;
    return (
      <View key={member.person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 20 }}>
        <Avatar uri={member.person.avatarUrl} name={member.person.displayName} size={48} />
        <View style={{ flex: 1 }}>
          <Txt numberOfLines={1} weight={700} style={{ fontSize: 15, lineHeight: 20 }}>
            {member.person.displayName}
          </Txt>
          <Txt numberOfLines={1} color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
            {detail}
          </Txt>
        </View>
        {action}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="People" subtitle={journey.data?.title} trailing={<View style={{ width: 40 }} />} />
      {members.isPending ? (
        <Loading />
      ) : members.isError || !data ? (
        <Problem error={members.error} onRetry={() => void members.refetch()} retrying={members.isRefetching} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {failed ? (
            <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: 20 }}>
              {messageFor(failed)}
            </Txt>
          ) : null}
          <GroupLabel style={{ marginHorizontal: 22 }}>On this journey</GroupLabel>
          {joined.map(row)}
          {waiting.length > 0 ? <GroupLabel style={{ marginHorizontal: 22 }}>Invited</GroupLabel> : null}
          {waiting.map(row)}

          {isOwner ? (
            <>
              <GroupLabel style={{ marginHorizontal: 22 }}>Add people</GroupLabel>
              <Txt color="muted" style={{ fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 6 }}>
                {data.spotsLeft > 0
                  ? `You can invite ${plural(data.spotsLeft, 'more person', 'more people')}. They add their own entries, and you stay in charge of the journey.`
                  : 'A journey has up to 4 authors. Remove someone to invite another person.'}
              </Txt>
              {data.spotsLeft === 0 ? null : invitable.isPending ? (
                <View style={{ height: 80 }}>
                  <Loading />
                </View>
              ) : (invitable.data ?? []).length === 0 ? (
                <Txt color="muted" style={{ fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginTop: 6 }}>
                  You can invite people who follow you. When someone follows you, they show up here.
                </Txt>
              ) : (
                (invitable.data ?? []).map((person) => (
                  <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: 20 }}>
                    <Avatar uri={person.avatarUrl} name={person.displayName} size={48} />
                    <View style={{ flex: 1 }}>
                      <Txt numberOfLines={1} weight={700} style={{ fontSize: 15, lineHeight: 20 }}>
                        {person.displayName}
                      </Txt>
                      <Txt numberOfLines={1} color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
                        @{person.username}
                      </Txt>
                    </View>
                    <Button label="Invite" inline size="sm" onPress={() => invite.mutate({ id, data: { username: person.username } })} />
                  </View>
                ))
              )}
            </>
          ) : null}

          <GroupLabel style={{ marginHorizontal: 22 }}>Who can do what</GroupLabel>
          <Card style={{ marginHorizontal: 16, borderRadius: 20 }}>
            {RULES.map((rule, index) => (
              <View key={rule.what} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
                <View style={{ flex: 1 }}>
                  <Txt weight={600} style={{ fontSize: 15, lineHeight: 20 }}>
                    {rule.what}
                  </Txt>
                  {rule.note ? (
                    <Txt color="muted" style={{ fontSize: 12.5, lineHeight: 17 }}>
                      {rule.note}
                    </Txt>
                  ) : null}
                </View>
                <Txt color="muted" style={{ fontSize: 14, lineHeight: 19 }}>
                  {rule.who}
                </Txt>
              </View>
            ))}
          </Card>
          <Txt color="muted" style={{ fontSize: 12.5, lineHeight: 18, marginTop: 12, marginHorizontal: 22 }}>
            A friend can leave at any time. Their entries stay unless they delete them.
          </Txt>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
