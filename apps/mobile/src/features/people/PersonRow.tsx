import type { ReactNode } from 'react';
import { View } from 'react-native';

import { layout } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Tap } from '@/ui/Motion';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

type Props = {
  person: { displayName: string; username: string; avatarUrl?: string | null };
  /** The line under the name. By default the person's @username. */
  detail?: string;
  /** Opens the person's profile, or whatever the list is for. Without it the row is not pressable. */
  onPress?: () => void;
  /** An action at the end of the row, such as Follow, Invite or Unblock. */
  trailing?: ReactNode;
};

/** A person in a list: picture, name, a line of detail, and an optional action at the end. The one row for every list of people. */
export function PersonRow({ person, detail, onPress, trailing }: Props) {
  const line = detail ?? `@${person.username}`;
  const main = (
    <>
      <Avatar uri={person.avatarUrl} name={person.displayName} size={48} />
      <View style={{ flex: 1 }}>
        <Txt variant="item" numberOfLines={1}>
          {person.displayName}
        </Txt>
        <Txt variant="caption" weight={500} numberOfLines={1} color="muted">
          {line}
        </Txt>
      </View>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9, paddingHorizontal: layout.rowGutter }}>
      {onPress ? (
        <Tap accessibilityRole="button" accessibilityLabel={words.people.rowSpoken(person.displayName, person.username)} scaleTo={0.985} onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {main}
        </Tap>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{main}</View>
      )}
      {trailing}
    </View>
  );
}
