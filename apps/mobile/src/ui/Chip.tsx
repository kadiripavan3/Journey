import type { ReactNode } from 'react';

import { radius, useTheme } from '@/theme';

import { Emoji } from './Emoji';
import { Tap } from './Motion';
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
    <Tap
      scaleTo={0.94}
      accessibilityRole={filter ? 'button' : 'checkbox'}
      accessibilityState={filter ? { selected: !!selected } : { checked: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: filter ? 6 : 8,
        paddingVertical: filter ? 9 : 10,
        paddingHorizontal: filter ? 14 : 15,
        borderRadius: radius.pill,
        backgroundColor: bg,
        borderWidth: selected && !filter ? 2 : 1.5,
        borderColor: selected ? colors.text : colors.line,
        margin: selected && !filter ? 0 : filter ? 0 : 0.5,
      }}>
      {icon}
      {emoji ? <Emoji char={emoji} size={filter ? 20 : 24} /> : null}
      <Txt variant={filter ? 'note' : 'control'} weight={700} style={{ color: fg }}>
        {label}
      </Txt>
    </Tap>
  );
}
