import { Text, type TextProps } from 'react-native';

import { type Colors, fontFor, type FontWeight, type TypeVariant, useTheme } from '@/theme';

type Props = TextProps & {
  /** One of the type styles from the design tokens. */
  variant?: TypeVariant;
  /** A colour name from the theme, or any colour value. */
  color?: keyof Colors | (string & {});
  weight?: FontWeight;
  center?: boolean;
};

/** All text in the app goes through here, so every size, weight and colour comes from the tokens. */
export function Txt({ variant = 'body', color = 'text', weight, center, style, ...rest }: Props) {
  const theme = useTheme();
  const t = theme.type[variant];
  const resolved = color in theme.colors ? theme.colors[color as keyof Colors] : color;
  return (
    <Text
      {...rest}
      style={[
        {
          fontFamily: fontFor[weight ?? (t.weight as FontWeight)],
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          letterSpacing: t.letterSpacing,
          color: resolved,
          textTransform: 'uppercase' in t ? 'uppercase' : undefined,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    />
  );
}
