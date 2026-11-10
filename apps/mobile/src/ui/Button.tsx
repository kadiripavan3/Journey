import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, Text, type ViewStyle } from 'react-native';

import { fontFor, useTheme } from '@/theme';

type Variant = 'primary' | 'ink' | 'line' | 'soft' | 'glass' | 'quiet' | 'danger';
type Size = 'lg' | 'md' | 'sm';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  /** Shown before the label. Receives the colour the label uses. */
  icon?: (color: string) => ReactNode;
  loading?: boolean;
  disabled?: boolean;
  /** Stretch to the full width of the parent. */
  block?: boolean;
  /** Set when the button sits in a row beside other things, so it is centred on the row instead of pinned to its top. */
  inline?: boolean;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT = { lg: 54, md: 46, sm: 36 } as const;
const FONT_SIZE = { lg: 16, md: 15, sm: 14 } as const;
const PADDING = { lg: 22, md: 20, sm: 16 } as const;

export function Button({ label, onPress, variant = 'primary', size = 'md', icon, loading, disabled, block, inline, style }: Props) {
  const { colors } = useTheme();
  const look: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    ink: { bg: colors.text, fg: colors.bg },
    line: { bg: 'transparent', fg: colors.text, border: colors.lineStrong },
    soft: { bg: colors.fill, fg: colors.text },
    glass: { bg: colors.photoGlass, fg: colors.onPhoto, border: colors.photoGlassLine },
    quiet: { bg: 'transparent', fg: colors.text },
    danger: { bg: colors.danger, fg: colors.onDanger },
  };
  const { bg, fg, border } = look[variant];
  const inactive = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        {
          height: HEIGHT[size],
          paddingHorizontal: PADDING[size],
          borderRadius: HEIGHT[size] / 2,
          backgroundColor: bg,
          borderWidth: border ? 1.5 : 0,
          borderColor: border,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          alignSelf: block ? 'stretch' : inline ? 'center' : 'flex-start',
          opacity: disabled ? 0.38 : pressed ? 0.85 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon?.(fg)}
      <Text
        numberOfLines={1}
        style={{
          fontFamily: fontFor[700],
          fontSize: FONT_SIZE[size],
          letterSpacing: -0.15,
          color: fg,
          textDecorationLine: variant === 'quiet' ? 'underline' : 'none',
        }}>
        {label}
      </Text>
    </Pressable>
  );
}
