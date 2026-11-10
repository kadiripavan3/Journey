import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import type { JourneyResponse } from '@/api/generated/journey';
import { firstName } from '@/lib/names';
import { Button } from '@/ui/Button';
import { GlassBar } from '@/ui/GlassBar';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

import { FollowButton } from './FollowButton';

/**
 * The bar that floats at the bottom of a journey's page with its one next step: Follow for a reader,
 * a new entry for the people who write in it.
 */
export function JourneyBar({ journey: j, style }: { journey: JourneyResponse; style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const first = firstName(j.owner.displayName);
  const writes = j.viewer.isOwner || j.viewer.isMember;
  const title = j.viewer.isOwner ? words.journeys.bar.yours : j.viewer.isMember ? words.journeys.bar.youWrite : j.viewer.isFollowing ? words.journeys.bar.youFollow(first) : words.journeys.bar.follow(first);
  const line = writes
    ? j.status === 'completed'
      ? words.journeys.bar.completed
      : j.status === 'paused'
        ? words.journeys.bar.paused
        : j.entryCount === 0
          ? words.journeys.bar.addFirst
          : words.journeys.bar.soFar(j.entryCount)
    : j.status === 'completed'
      ? words.journeys.bar.readerCompleted
      : words.journeys.bar.readerActive;
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
          <Button label={words.journeys.bar.entry} inline icon={(c) => <Plus size={19} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${j.id}/add`)} />
        ) : null
      ) : (
        <FollowButton journey={j} size="md" />
      )}
    </GlassBar>
  );
}
