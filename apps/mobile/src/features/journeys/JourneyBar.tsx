import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import type { JourneyResponse } from '@/api/generated/journey';
import { firstName } from '@/lib/names';
import { plural } from '@/words/en/plural';
import { Button } from '@/ui/Button';
import { GlassBar } from '@/ui/GlassBar';
import { Txt } from '@/ui/Txt';

import { FollowButton } from './FollowButton';

/**
 * The bar that floats at the bottom of a journey's page with its one next step: Follow for a reader,
 * a new entry for the people who write in it.
 */
export function JourneyBar({ journey: j, style }: { journey: JourneyResponse; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const first = firstName(j.owner.displayName);
  const writes = j.viewer.isOwner || j.viewer.isMember;
  const title = j.viewer.isOwner ? 'Your journey' : j.viewer.isMember ? 'You write in this journey' : j.viewer.isFollowing ? `You follow ${first}'s journey` : `Follow ${first}'s journey`;
  const line = writes
    ? j.status === 'completed'
      ? 'Completed'
      : j.status === 'paused'
        ? 'Paused. A new entry starts it again.'
        : j.entryCount === 0
          ? 'Add the first entry'
          : `${plural(j.entryCount, 'entry', 'entries')} so far`
    : j.status === 'completed'
      ? 'This journey is completed'
      : 'New entries land on your Home';
  return (
    <GlassBar radius="sheet" style={style} contentStyle={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingLeft: 20, paddingRight: 10 }}>
      <View style={{ flex: 1 }}>
        <Txt variant="item" numberOfLines={1} weight={800}>
          {title}
        </Txt>
        <Txt variant="footnote" numberOfLines={1} color="muted">
          {line}
        </Txt>
      </View>
      {writes ? (
        j.viewer.canAddEntry ? (
          <Button label="Entry" inline icon={(c) => <Plus size={19} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add`)} />
        ) : null
      ) : (
        <FollowButton journey={j} size="md" />
      )}
    </GlassBar>
  );
}
