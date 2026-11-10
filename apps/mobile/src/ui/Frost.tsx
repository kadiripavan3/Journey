import { BlurView } from 'expo-blur';

import { useTheme } from '@/theme';

/**
 * The blur behind a glass control. Put it first inside a view that has rounded corners and `overflow: 'hidden'`,
 * and give that view a see-through colour: what is behind shows through, softened.
 * It sits behind everything else in that view, so icons and text stay sharp on top.
 */
export function Frost({ tone = 'theme', intensity = 28 }: { tone?: 'theme' | 'dark'; intensity?: number }) {
  const { scheme } = useTheme();
  return <BlurView pointerEvents="none" intensity={intensity} tint={tone === 'dark' ? 'dark' : scheme} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }} />;
}
