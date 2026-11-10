import { useColorScheme } from 'react-native';

import { palettes, radius, shadows, space, type } from './tokens';

export type Scheme = 'light' | 'dark';
export type Colors = { [K in keyof (typeof palettes)['light']]: string };
export type TypeVariant = keyof typeof type;

/** The font file for each weight of Plus Jakarta Sans (loaded in the root layout). */
export const fontFor = {
  400: 'PlusJakartaSans_400Regular',
  500: 'PlusJakartaSans_500Medium',
  600: 'PlusJakartaSans_600SemiBold',
  700: 'PlusJakartaSans_700Bold',
  800: 'PlusJakartaSans_800ExtraBold',
} as const;
export type FontWeight = keyof typeof fontFor;

export type Theme = {
  scheme: Scheme;
  colors: Colors;
  /** Box shadows: "md" lifts cards and bars, "sm" outlines quiet surfaces. */
  shadow: { md: string; sm: string };
  radius: typeof radius;
  space: typeof space;
  type: typeof type;
};

export function themeFor(scheme: Scheme): Theme {
  return { scheme, colors: palettes[scheme], shadow: shadows[scheme], radius, space, type };
}

/** The theme for the phone's current light or dark setting. */
export function useTheme(): Theme {
  return themeFor(useColorScheme() === 'dark' ? 'dark' : 'light');
}

/** Always-dark theme, for screens that sit on a full-bleed photo. */
export const darkTheme = themeFor('dark');
