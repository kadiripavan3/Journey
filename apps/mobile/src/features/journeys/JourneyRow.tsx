import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { layout } from '@/theme';
import { Photo } from '@/ui/Photo';
import { Txt } from '@/ui/Txt';

/** A journey as a compact row: small cover, title, a line of detail, and an optional action at the end. */
export function JourneyRow({ coverUrl, title, detail, trailing, onPress, faded }: { coverUrl?: string | null; title: string; detail: string; trailing?: ReactNode; onPress?: () => void; faded?: boolean }) {
  const main = (
    <>
      <Photo uri={coverUrl} radius="field" style={{ width: 64, height: 64 }} />
      <View style={{ flex: 1 }}>
        <Txt variant="item" numberOfLines={2}>
          {title}
        </Txt>
        <Txt variant="footnote" numberOfLines={2} color="muted" style={{ marginTop: 2 }}>
          {detail}
        </Txt>
      </View>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, paddingHorizontal: layout.rowGutter, opacity: faded ? 0.55 : 1 }}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${detail}`} onPress={onPress} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.8 : 1 })}>
          {main}
        </Pressable>
      ) : (
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>{main}</View>
      )}
      {trailing}
    </View>
  );
}
