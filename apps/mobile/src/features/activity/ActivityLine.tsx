import { useRouter } from 'expo-router';
import { View } from 'react-native';

import type { ActivityItemResponse } from '@/api/generated/journey';
import { hrefFor } from '@/features/notifications/target';
import { PersonFollowButton } from '@/features/people/PersonFollowButton';
import { timeAgo } from '@/lib/dates';
import { layout, radius, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Txt } from '@/ui/Txt';

import { tell } from './kinds';

/** One line of Activity: who, what, when, and the picture it is about. Tapping it opens what it is about. */
export function ActivityLine({ item, fresh }: { item: ActivityItemResponse; fresh?: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  const [first, second] = item.actors;
  const bold = (text: string | null) => (
    <Txt variant="callout" weight={800}>
      {text}
    </Txt>
  );
  const told = tell(item, bold);
  if (!first || !told) return null;

  const who =
    item.actorCount <= 1 || !second ? (
      bold(first.displayName)
    ) : item.actorCount === 2 ? (
      <>
        {bold(first.displayName)} and {bold(second.displayName)}
      </>
    ) : (
      <>
        {bold(`${first.displayName}, ${second.displayName}`)} and {item.actorCount - 2} {item.actorCount === 3 ? 'other' : 'others'}
      </>
    );

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 11, paddingHorizontal: layout.rowGutter, backgroundColor: fresh ? colors.accentSoft : 'transparent' }}>
      <Tap accessibilityRole="button" scaleTo={0.985} onPress={() => router.push(hrefFor(told.path))} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        {second && item.actorCount > 1 ? (
          <View style={{ width: 44, height: 44 }}>
            <View style={{ position: 'absolute', left: 0, top: 0 }}>
              <Avatar uri={first.avatarUrl} name={first.displayName} size={30} />
            </View>
            <View style={{ position: 'absolute', right: 0, bottom: 0, borderRadius: radius.field, borderWidth: 2, borderColor: fresh ? colors.accentSoft : colors.bg }}>
              <Avatar uri={second.avatarUrl} name={second.displayName} size={28} />
            </View>
          </View>
        ) : (
          <Avatar uri={first.avatarUrl} name={first.displayName} size={44} />
        )}
        <View style={{ flex: 1 }}>
          <Txt variant="callout" numberOfLines={4}>
            {who}
            {told.what}
          </Txt>
          <Txt variant="footnote" color="muted" style={{ marginTop: 3 }}>
            {timeAgo(item.at)}
          </Txt>
        </View>
        {item.thumbUrl ? <Photo uri={item.thumbUrl} radius="tile" style={{ width: 48, height: 48 }} /> : null}
      </Tap>
      {item.kind === 'profile_follow' && !item.followsActor ? <PersonFollowButton username={first.username} isFollowing={false} followsYou /> : null}
    </View>
  );
}
