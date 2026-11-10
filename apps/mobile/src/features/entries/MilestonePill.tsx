import { Star } from 'lucide-react-native';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme';
import { Pill } from '@/ui/Pill';
import { words } from '@/words';

/** The accent pill that marks a milestone entry. */
export function MilestonePill({ style }: { style?: ComponentProps<typeof Pill>['style'] }) {
  const { colors } = useTheme();
  return <Pill tone="accent" label={words.entry.milestone} icon={() => <Star size={13} color={colors.onAccent} fill={colors.onAccent} />} style={style} />;
}
