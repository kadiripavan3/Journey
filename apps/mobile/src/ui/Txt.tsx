import { Text, type TextProps } from 'react-native';

import { type Colors, type FontWeight, textStyle, type TypeVariant, useTheme } from '@/theme';

type Props = TextProps & {
  /** One of the text styles from the design tokens. It sets the size, line height, weight and letter spacing. */
  variant?: TypeVariant;
  /** A colour name from the theme, or any colour value. */
  color?: keyof Colors | (string & {});
  /** A different weight than the variant's own. */
  weight?: FontWeight;
  center?: boolean;
};

/** All text in the app goes through here, so every size, weight and colour comes from the tokens. */
export function Txt({ variant = 'body', color = 'text', weight, center, style, ...rest }: Props) {
  const theme = useTheme();
  const resolved = color in theme.colors ? theme.colors[color as keyof Colors] : color;
  return (
    <Text
      {...rest}
      style={[
        textStyle(variant, weight),
        {
          color: resolved,
          textTransform: 'uppercase' in theme.type[variant] ? 'uppercase' : undefined,
          textAlign: center ? 'center' : undefined,
        },
        style,
      ]}
    />
  );
}
