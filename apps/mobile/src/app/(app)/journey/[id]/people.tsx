import { useLocalSearchParams } from 'expo-router';
import { Link as LinkIcon, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type InviteLinkResponse, type MemberResponse, useCreateInviteLink, useGetInvitableInfinite, useGetJourney, useGetMe, useGetMembers, useInviteMember, useRemoveMember } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { paged, rows } from '@/api/pages';
import { useLeave } from '@/features/navigation/useLeave';
import { PersonRow } from '@/features/people/PersonRow';
import { PageProblem } from '@/features/states/PageProblem';
import { MoreButton } from '@/ui/MoreButton';
import { formatDay, timeAgo } from '@/lib/dates';
import { wentAway } from '@/lib/loading';
import { firstName } from '@/lib/names';
import { plural } from '@/lib/plural';
import { shareLink } from '@/lib/share';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { GroupLabel } from '@/ui/Heading';
import { LinkBox } from '@/ui/LinkBox';
import { Loading } from '@/ui/Loading';
import { Txt } from '@/ui/Txt';

const RULES = [
  { what: 'Add entries', note: 'And edit or delete their own', who: 'Everyone' },
  { what: 'Change the journey', note: 'Title, cover, who sees it, completing it', who: 'Only the owner' },
  { what: 'Remove people or entries', note: '', who: 'Only the owner' },
];

/** 8.1 and 8.6 People on a journey: who can add entries, who is still deciding, and (for the owner) who to invite. */
export default function JourneyPeople() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leave = useLeave();
  const { colors } = useTheme();
  const cache = useCache();
  const myId = useGetMe().data?.id;
  const journey = useGetJourney(id);
  const members = useGetMembers(id);
  const isOwner = members.data?.viewerRole === 'owner';
  const invitable = useGetInvitableInfinite(id, undefined, { query: { ...paged, enabled: isOwner } });
  const candidates = rows(invitable.data) ?? [];
  const invite = useInviteMember({ mutation: { onSuccess: () => cache.membersChanged(id) } });
  // Removing a friend, or leaving, takes away the right to write here: it asks first.
  const [going, setGoing] = useState<MemberResponse | null>(null);
  const remove = useRemoveMember({
    mutation: {
      onSuccess: async (_, { username }) => {
        const left = members.data?.members.find((m) => m.person.username === username)?.person.id === myId;
        setGoing(null);
        await cache.membersChanged(id);
        if (left) leave();
      },
    },
  });
  const failed = invite.error ?? (going ? null : remove.error);
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
        <Txt variant="caption" color="muted" weight={700}>
          Owner
        </Txt>
      ) : isOwner ? (
        member.status === 'invited' ? (
          <Button label="Cancel" inline size="sm" variant="line" onPress={() => remove.mutate({ id, username: member.person.username })} />
        ) : (
          <Button label="Remove" inline size="sm" variant="line" onPress={() => setGoing(member)} />
        )
      ) : me ? (
        <Button label="Leave" inline size="sm" variant="line" onPress={() => setGoing(member)} />
      ) : null;
    return <PersonRow key={member.person.id} person={member.person} detail={detail} trailing={action} />;
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="People" subtitle={journey.data?.title} trailing={<View style={{ width: 40 }} />} />
      {!data || wentAway(members) ? (
        members.isError ? <PageProblem error={members.error} onRetry={() => void members.refetch()} retrying={members.isFetching} /> : <Loading offline={members.isPaused} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {failed ? (
            <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: layout.rowGutter }}>
              {messageFor(failed)}
            </Txt>
          ) : null}
          <GroupLabel style={{ marginHorizontal: layout.gutter }}>On this journey</GroupLabel>
          {joined.map(row)}
          {waiting.length > 0 ? <GroupLabel style={{ marginHorizontal: layout.gutter }}>Invited</GroupLabel> : null}
          {waiting.map(row)}

          {isOwner ? (
            <>
              <GroupLabel style={{ marginHorizontal: layout.gutter }}>Add people</GroupLabel>
              <Txt variant="callout" color="muted" style={{ marginHorizontal: layout.rowGutter, marginBottom: 6 }}>
                {data.spotsLeft > 0
                  ? `You can invite ${plural(data.spotsLeft, 'more person', 'more people')}. They add their own entries, and you stay in charge of the journey.`
                  : `A journey has up to ${plural(data.members.length, 'author')}. Remove someone to invite another person.`}
              </Txt>
              {data.spotsLeft === 0 ? null : invitable.isPending ? (
                <View style={{ height: 80 }}>
                  <Loading offline={invitable.isPaused} />
                </View>
              ) : candidates.length === 0 ? (
                <Txt variant="callout" color="muted" style={{ marginHorizontal: layout.rowGutter, marginTop: 6 }}>
                  You can invite people who follow you. When someone follows you, they show up here.
                </Txt>
              ) : (
                <>
                  {candidates.map((person) => (
                    <PersonRow key={person.id} person={person} trailing={<Button label="Invite" inline size="sm" onPress={() => invite.mutate({ id, data: { username: person.username } })} />} />
                  ))}
                  <MoreButton pages={invitable} />
                </>
              )}
              {data.spotsLeft > 0 && journey.data && journey.data.status !== 'completed' ? <InviteLink journeyId={id} title={journey.data.title} /> : null}
            </>
          ) : null}

          <GroupLabel style={{ marginHorizontal: layout.gutter }}>Who can do what</GroupLabel>
          <Card style={{ marginHorizontal: layout.barGutter, borderRadius: radius.card }}>
            {RULES.map((rule, index) => (
              <View key={rule.what} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: layout.barGutter, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="item" weight={600}>
                    {rule.what}
                  </Txt>
                  {rule.note ? (
                    <Txt variant="footnote" color="muted">
                      {rule.note}
                    </Txt>
                  ) : null}
                </View>
                <Txt variant="callout" color="muted">
                  {rule.who}
                </Txt>
              </View>
            ))}
          </Card>
          <Txt variant="footnote" color="muted" style={{ marginTop: 12, marginHorizontal: layout.gutter }}>
            A friend can leave at any time. Their entries stay unless they delete them.
          </Txt>
        </ScrollView>
      )}
      <ConfirmSheet
        visible={!!going}
        onClose={() => setGoing(null)}
        title={going?.person.id === myId ? 'Leave this journey?' : `Remove ${firstName(going?.person.displayName ?? '')} from this journey?`}
        body={going?.person.id === myId ? "You won't be able to add entries any more. The ones you wrote stay unless you delete them." : "They won't be able to add entries any more. The ones they wrote stay unless they delete them."}
        confirm={going?.person.id === myId ? 'Leave journey' : 'Remove'}
        cancel={going?.person.id === myId ? 'Stay' : 'Keep them'}
        busy={remove.isPending}
        problem={remove.isError ? messageFor(remove.error) : null}
        onConfirm={() => going && remove.mutate({ id, username: going.person.username })}
      />
    </SafeAreaView>
  );
}

/** "Not on Journey yet?": a one-time link for a friend who doesn't have the app. It is shown once, when it is made. */
function InviteLink({ journeyId, title }: { journeyId: string; title: string }) {
  const [link, setLink] = useState<InviteLinkResponse | null>(null);
  const make = useCreateInviteLink({ mutation: { onSuccess: setLink } });
  return (
    <>
      <GroupLabel style={{ marginHorizontal: layout.gutter }}>Not on Journey yet?</GroupLabel>
      {link ? (
        <>
          <LinkBox url={link.url} icon={(c) => <LinkIcon size={18} color={c} />} style={{ marginHorizontal: layout.barGutter }} />
          <Txt variant="small" color="muted" style={{ marginTop: 12, marginHorizontal: 28 }}>
            The link works once, for one person, until {formatDay(link.expiresAt.slice(0, 10))}. Copy or send it now: it isn&apos;t shown again.
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginHorizontal: layout.barGutter }}>
            <Button label="Send the link" size="sm" variant="soft" icon={(c) => <Share2 size={15} color={c} />} onPress={() => void shareLink(`Add to ${title} with me on Journey`, link.url)} />
            <Button label="Make a new link" size="sm" variant="quiet" loading={make.isPending} onPress={() => make.mutate({ id: journeyId })} />
          </View>
        </>
      ) : (
        <>
          <Txt variant="callout" color="muted" style={{ marginHorizontal: layout.rowGutter, marginBottom: 12 }}>
            Make a link for a friend who doesn&apos;t have Journey yet. They join when they open it and sign up.
          </Txt>
          <Button label="Make an invite link" variant="soft" icon={(c) => <LinkIcon size={18} color={c} />} loading={make.isPending} onPress={() => make.mutate({ id: journeyId })} style={{ marginHorizontal: layout.barGutter }} />
          <Txt variant="small" color="muted" style={{ marginTop: 12, marginHorizontal: 28 }}>
            The link works once, for one person, and for a few days only.
          </Txt>
        </>
      )}
      {make.isError ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginTop: 8, marginHorizontal: layout.rowGutter }}>
          {messageFor(make.error)}
        </Txt>
      ) : null}
    </>
  );
}
