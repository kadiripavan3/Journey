import { useLocalSearchParams, useRouter } from 'expo-router';

import { useCache } from '@/api/cache';
import { ApiError } from '@/api/fetcher';
import { useAcceptInviteLink, useGetLinkInvitation } from '@/api/generated/journey';
import { InvitationView } from '@/features/journeys/InvitationView';
import { useLeave } from '@/features/navigation/useLeave';
import { words } from '@/words';

/**
 * 8.2 Invitation, reached by an invite link: a friend who wasn't on Journey yet got a one-time link,
 * signed up, and lands here. Saying yes joins the journey and uses the link up.
 */
export default function LinkInvitation() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const cache = useCache();
  // The link works once: after joining, asking for it again would say it is gone, so it is asked for once.
  const invitation = useGetLinkInvitation(token, { query: { staleTime: Infinity, refetchOnWindowFocus: false } });
  const leave = useLeave();
  const accept = useAcceptInviteLink({
    mutation: {
      onSuccess: async (journey) => {
        await cache.membersChanged(journey.id);
        router.replace(`/journey/${journey.id}`);
      },
    },
  });
  // A link that was used, ran out or never existed is an answer, not a failure to show a retry for.
  const gone = invitation.error instanceof ApiError && invitation.error.status === 404;

  return (
    <InvitationView
      invitation={invitation.data ?? null}
      loading={invitation.isPending}
      loadError={invitation.isError && !gone ? invitation.error : undefined}
      onRetry={() => void invitation.refetch()}
      retrying={invitation.isRefetching}
      gone={words.shared.invitation.linkGone}
      failed={accept.error}
      onJoin={() => accept.mutate({ token })}
      joining={accept.isPending}
      onDecline={leave}
      onClose={leave}
    />
  );
}
