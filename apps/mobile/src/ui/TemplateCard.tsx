import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { Txt } from './Txt';

type Props = { emoji: string; name: string; description: string; selected?: boolean; tag?: string; onPress?: () => void };

/** A starting point for a journey: an emoji, a name and what it gives you. Two sit side by side. */
export function TemplateCard({ emoji, name, description, selected, tag, onPress }: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${description}`}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        gap: 4,
        padding: selected ? 15.5 : 16,
        borderRadius: 22,
        backgroundColor: colors.bg,
        borderWidth: selected ? 2 : 1.5,
        borderColor: selected ? colors.text : colors.line,
        opacity: pressed ? 0.85 : 1,
      })}>
      {tag ? (
        <View style={{ position: 'absolute', top: 12, right: 12, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 9, backgroundColor: colors.accent }}>
          <Txt weight={800} style={{ fontSize: 10.5, lineHeight: 13, letterSpacing: 0.4, color: colors.onAccent }}>
            {tag}
          </Txt>
        </View>
      ) : null}
      <Txt accessible={false} style={{ fontSize: 34, lineHeight: 42, marginBottom: 6 }}>
        {emoji}
      </Txt>
      <Txt weight={800} style={{ fontSize: 16, lineHeight: 21, letterSpacing: -0.25 }}>
        {name}
      </Txt>
      <Txt color="muted" style={{ fontSize: 12.5, lineHeight: 17.5 }}>
        {description}
      </Txt>
    </Pressable>
  );
}
