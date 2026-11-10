import type { ReactNode } from 'react';
import { Pressable } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  /** What the button does, for screen readers. */
  label: string;
  onPress?: () => void;
  icon: (color: string) => ReactNode;
  /** "photo" sits on a picture; "soft" sits on the page. */
  tone?: 'soft' | 'photo';
};

/** A round icon button, such as Back or Close. 40 pt wide, with a 44 pt touch area. */
export function RoundButton({ label, onPress, icon, tone = 'soft' }: Props) {
  const { colors } = useTheme();
  const onPhoto = tone === 'photo';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: onPhoto ? colors.photoGlass : colors.fill,
        borderWidth: onPhoto ? 1 : 0,
        borderColor: colors.photoGlassLine,
        opacity: pressed ? 0.7 : 1,
      })}>
      {icon(onPhoto ? colors.onPhoto : colors.text)}
    </Pressable>
  );
}
