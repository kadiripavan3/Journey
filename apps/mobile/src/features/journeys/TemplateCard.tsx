import { View } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Emoji } from '@/ui/Emoji';
import { Tap } from '@/ui/Motion';
import { Txt } from '@/ui/Txt';

type Props = { emoji: string; name: string; description: string; selected?: boolean; tag?: string; onPress?: () => void };

/** A starting point for a journey: an emoji, a name and what it gives you. Two sit side by side. */
export function TemplateCard({ emoji, name, description, selected, tag, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${description}`}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={{
        flex: 1,
        gap: 4,
        padding: selected ? 15.5 : 16,
        borderRadius: radius.cardLarge,
        backgroundColor: colors.bg,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? colors.text : colors.line,
      }}>
      {tag ? (
        <View style={{ position: 'absolute', top: 12, right: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: radius.chip, backgroundColor: colors.accent }}>
          <Txt variant="micro" style={{ color: colors.onAccent }}>
            {tag}
          </Txt>
        </View>
      ) : null}
      <View style={{ marginBottom: 6 }}>
        <Emoji char={emoji} size={44} />
      </View>
      <Txt variant="headline" weight={800}>
        {name}
      </Txt>
      <Txt variant="footnote" color="muted">
        {description}
      </Txt>
    </Tap>
  );
}
