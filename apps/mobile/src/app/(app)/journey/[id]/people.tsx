import { useLocalSearchParams, useRouter } from 'expo-router';
import { Link as LinkIcon, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { type InviteLinkResponse, type MemberResponse, useCreateInviteLink, useGetInvitableInfinite, useGetJourney, useGetMe, useGetMembers, useInviteMember, useRemoveMember } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { paged, rows } from '@/api/pages';
import { MoreButton } from '@/ui/MoreButton';
import { timeAgo } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { shareLink } from '@/lib/share';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { GroupLabel } from '@/ui/Heading';
import { LinkBox } from '@/ui/LinkBox';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
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
  const cache = useCache();
  const myId = useGetMe().data?.id;
  const journey = useGetJourney(id);
  const members = useGetMembers(id);
  const isOwner = members.data?.viewerRole === 'owner';
  const invitable = useGetInvitableInfinite(id, undefined, { query: { ...paged, enabled: isOwner } });
  const candidates = rows(invitable.data) ?? [];
  const invite = useInviteMember({ mutation: { onSuccess: () => cache.membersChanged(id) } });
  const remove = useRemoveMember({
    mutation: {
      onSuccess: async (_, { username }) => {
        const left = members.data?.members.find((m) => m.person.username === username)?.person.id === myId;
        await cache.membersChanged(id);
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
        <Txt variant="caption" color="muted" weight={700}>
          Owner
        </Txt>
      ) : isOwner ? (
        <Button label={member.status === 'invited' ? 'Cancel' : 'Remove'} inline size="sm" variant="line" onPress={() => remove.mutate({ id, username: member.person.username })} />
      ) : me ? (
        <Button label="Leave" inline size="sm" variant="line" onPress={() => remove.mutate({ id, username: member.person.username })} />
      ) : null;
    return (
      <View key={member.person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: layout.rowGutter }}>
        <Avatar uri={member.person.avatarUrl} name={member.person.displayName} size={48} />
        <View style={{ flex: 1 }}>
          <Txt variant="item" numberOfLines={1}>
            {member.person.displayName}
          </Txt>
          <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
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
        <Problem message={messageFor(members.error)} onRetry={() => void members.refetch()} retrying={members.isRefetching} />
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
                  : 'A journey has up to 4 authors. Remove someone to invite another person.'}
              </Txt>
              {data.spotsLeft === 0 ? null : invitable.isPending ? (
                <View style={{ height: 80 }}>
                  <Loading />
                </View>
              ) : candidates.length === 0 ? (
                <Txt variant="callout" color="muted" style={{ marginHorizontal: layout.rowGutter, marginTop: 6 }}>
                  You can invite people who follow you. When someone follows you, they show up here.
                </Txt>
              ) : (
                <>
                  {candidates.map((person) => (
                  <View key={person.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: layout.rowGutter }}>
                    <Avatar uri={person.avatarUrl} name={person.displayName} size={48} />
                    <View style={{ flex: 1 }}>
                      <Txt variant="item" numberOfLines={1}>
                        {person.displayName}
                      </Txt>
                      <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
                        @{person.username}
                      </Txt>
                    </View>
                    <Button label="Invite" inline size="sm" onPress={() => invite.mutate({ id, data: { username: person.username } })} />
                  </View>
                  ))}
                  <MoreButton pages={invitable} />
                </>
              )}
              {data.spotsLeft > 0 && journey.data && journey.data.status !== 'completed' ? <InviteLink journeyId={id} title={journey.data.title} /> : null}
            </>
          ) : null}

          <GroupLabel style={{ marginHorizontal: layout.gutter }}>Who can do what</GroupLabel>
          <Card style={{ marginHorizontal: 16, borderRadius: radius.card }}>
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
            The link works once, for one person, for 7 days. Copy or send it now: it isn&apos;t shown again.
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginHorizontal: layout.barGutter }}>
            <Button label="Send the link" size="sm" variant="soft" icon={(c) => <Share2 size={15} color={c} />} onPress={() => void shareLink(`Add to ${title} with me`, link.url)} />
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
            The link works once, for one person, for 7 days.
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
