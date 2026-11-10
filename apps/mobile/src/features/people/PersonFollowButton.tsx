import { Check } from 'lucide-react-native';

import { useFollowProfile, useUnfollowProfile } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { Button } from '@/ui/Button';
import { words } from '@/words';

type Props = {
  username: string;
  isFollowing: boolean;
  /** True when they already follow you: the button then says "Follow back". */
  followsYou?: boolean;
  size?: 'sm' | 'md';
  /** Fill the width, for the main button on a profile. */
  block?: boolean;
  /** The first name, for "Follow Maya" on a profile. */
  name?: string;
};

/** Follow or stop following a person. Shows the new state straight away. */
export function PersonFollowButton({ username, isFollowing, followsYou, size = 'sm', block, name }: Props) {
  const cache = useCache();
  const follow = useFollowProfile({ mutation: { onSuccess: (profile) => cache.personFollowed(profile) } });
  const unfollow = useUnfollowProfile({ mutation: { onSuccess: (profile) => cache.personFollowed(profile) } });
  const busy = follow.isPending || unfollow.isPending;
  const following = follow.isPending ? true : unfollow.isPending ? false : isFollowing;

  return following ? (
    <Button
      label={words.common.following}
      inline={!block}
      block={block}
      size={size}
      variant="soft"
      icon={(c) => <Check size={16} color={c} strokeWidth={2.6} />}
      onPress={() => {
        if (!busy) unfollow.mutate({ username });
      }}
    />
  ) : (
    <Button
      label={followsYou ? words.people.followBack : name ? words.people.followName(name) : words.common.follow}
      inline={!block}
      block={block}
      size={size}
      onPress={() => {
        if (!busy) follow.mutate({ username });
      }}
    />
  );
}
