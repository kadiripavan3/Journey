import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { fontFor, useTheme } from '@/theme';

import { Txt } from './Txt';

type Props = {
  label: string;
  emoji?: string;
  selected?: boolean;
  onPress?: () => void;
  /** "choice" is for picking several (interests); "filter" is for one-of-many filters. */
  tone?: 'choice' | 'filter';
  icon?: ReactNode;
};

/** A rounded, tappable label. */
export function Chip({ label, emoji, selected, onPress, tone = 'choice', icon }: Props) {
  const { colors } = useTheme();
  const filter = tone === 'filter';
  const bg = selected ? (filter ? colors.text : colors.fill) : colors.bg;
  const fg = selected && filter ? colors.bg : colors.text;
  return (
    <Pressable
      accessibilityRole={filter ? 'button' : 'checkbox'}
      accessibilityState={filter ? { selected: !!selected } : { checked: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: filter ? 6 : 8,
        paddingVertical: filter ? 9 : 10,
        paddingHorizontal: filter ? 14 : 15,
        borderRadius: 24,
        backgroundColor: bg,
        borderWidth: selected && !filter ? 2 : 1.5,
        borderColor: selected ? colors.text : colors.line,
        margin: selected && !filter ? 0 : filter ? 0 : 0.5,
        opacity: pressed ? 0.8 : 1,
      })}>
      {icon}
      {emoji ? <Txt style={{ fontSize: filter ? 16 : 19, lineHeight: filter ? 20 : 23 }}>{emoji}</Txt> : null}
      <Txt style={{ fontFamily: fontFor[700], fontSize: filter ? 13.5 : 14.5, lineHeight: 20, color: fg }}>{label}</Txt>
    </Pressable>
  );
}
