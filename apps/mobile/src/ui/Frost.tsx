import { BlurView } from 'expo-blur';
import { View } from 'react-native';

import { useTheme } from '@/theme';

type Props = {
  tone?: 'theme' | 'dark';
  intensity?: number;
  /**
   * "blur" softens what is behind: for the one bar, sheet or button a screen has on a photo.
   * "tint" only darkens it a little and costs nothing to draw: for labels that repeat down a list.
   */
  mode?: 'blur' | 'tint';
};

const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 } as const;

/**
 * What sits behind a glass control. Put it first inside a view that has rounded corners and `overflow: 'hidden'`,
 * and give that view a see-through colour: what is behind shows through, softened.
 * It sits behind everything else in that view, so icons and text stay sharp on top.
 */
export function Frost({ tone = 'theme', intensity = 28, mode = 'blur' }: Props) {
  const { scheme, colors } = useTheme();
  if (mode === 'tint') {
    // The theme's own glass colour is nearly solid already; on a photo the label needs a little more behind it.
    return tone === 'dark' ? <View pointerEvents="none" style={[FILL, { backgroundColor: colors.photoTint }]} /> : null;
  }
  return <BlurView pointerEvents="none" intensity={intensity} tint={tone === 'dark' ? 'dark' : scheme} style={FILL} />;
}
