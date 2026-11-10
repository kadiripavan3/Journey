import type { ReactNode } from 'react';
import { View } from 'react-native';

import { layout } from '@/theme';
import { Tap } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Pill } from '@/ui/Pill';
import { Txt } from '@/ui/Txt';

type Props = {
  coverUrl?: string | null;
  title: string;
  detail: string;
  /** A small label before the detail, such as "Shared". */
  badge?: string;
  /** An action at the end, such as Follow. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** For a journey with nothing new: quieter, but as easy to read. */
  quiet?: boolean;
};

/** A journey as a compact row: small cover, title, a line of detail, and an optional action at the end. */
export function JourneyRow({ coverUrl, title, detail, badge, trailing, onPress, quiet }: Props) {
  const main = (
    <>
      <View style={{ opacity: quiet ? 0.6 : 1 }}>
        <Photo uri={coverUrl} radius="field" style={{ width: 64, height: 64 }} />
      </View>
      <View style={{ flex: 1 }}>
        <Txt variant="item" weight={quiet ? 600 : undefined} numberOfLines={2}>
          {title}
        </Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          {badge ? <Pill label={badge} style={{ paddingVertical: 2, paddingHorizontal: 7 }} /> : null}
          <Txt variant="footnote" numberOfLines={2} color="muted" style={{ flex: 1 }}>
            {detail}
          </Txt>
        </View>
      </View>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: layout.rowGutter }}>
      {onPress ? (
        <Tap accessibilityRole="button" accessibilityLabel={`${title}. ${badge ? `${badge}. ` : ''}${detail}`} scaleTo={0.985} onPress={onPress} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {main}
        </Tap>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{main}</View>
      )}
      {trailing}
    </View>
  );
}
