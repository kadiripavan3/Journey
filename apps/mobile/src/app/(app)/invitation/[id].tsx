import { useLocalSearchParams, useRouter } from 'expo-router';

import { useAcceptInvitation, useGetInvitationsInfinite, useGetMe, useRemoveMember } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { paged, rows } from '@/api/pages';
import { InvitationView } from '@/features/journeys/InvitationView';

/** 8.2 Invitation: what the friend sees when someone asked them in the app. */
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

  return (
    <InvitationView
      invitation={invitation ?? null}
      loading={invitations.isPending}
      loadError={invitations.isError ? invitations.error : undefined}
      onRetry={() => void invitations.refetch()}
      retrying={invitations.isRefetching}
      gone="This invitation isn't there any more."
      failed={accept.error ?? decline.error}
      onJoin={() => accept.mutate({ id })}
      joining={accept.isPending}
      onDecline={() => me && decline.mutate({ id, username: me.username })}
      declining={decline.isPending}
      onClose={() => router.back()}
    />
  );
}
