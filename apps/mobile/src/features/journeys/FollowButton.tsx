import { Check, Plus } from 'lucide-react-native';

import { useFollowJourney, useUnfollowJourney } from '@/api/generated/journey';
import type { JourneyResponse } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { Button } from '@/ui/Button';

type Props = { journey: JourneyResponse; size?: 'sm' | 'md'; onChanged?: (following: boolean) => void };

/** Follow or stop following one journey. Shows the new state straight away. */
export function FollowButton({ journey, size = 'sm', onChanged }: Props) {
  const cache = useCache();
  const follow = useFollowJourney({ mutation: { onSuccess: (followed) => { onChanged?.(true); return cache.journeyFollowed(followed); } } });
  const unfollow = useUnfollowJourney({ mutation: { onSuccess: (unfollowed) => { onChanged?.(false); return cache.journeyFollowed(unfollowed); } } });
  const busy = follow.isPending || unfollow.isPending;
  // While a request is on its way, show where it is heading.
  const following = follow.isPending ? true : unfollow.isPending ? false : journey.viewer.isFollowing;

  if (journey.viewer.isOwner) return null;
  return following ? (
    <Button
      label="Following"
      inline
      size={size}
      variant="soft"
      icon={(c) => <Check size={16} color={c} strokeWidth={2.6} />}
      onPress={() => {
        if (!busy) unfollow.mutate({ id: journey.id });
      }}
    />
  ) : (
    <Button
      label="Follow"
      inline
      size={size}
      icon={size === 'md' ? (c) => <Plus size={18} color={c} strokeWidth={2.6} /> : undefined}
      onPress={() => {
        if (!busy) follow.mutate({ id: journey.id });
      }}
    />
  );
}
