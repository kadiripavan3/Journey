import { Check } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';

import { radius, useTheme } from '@/theme';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

/**
 * 3.3 "You're all caught up": where a feed ends. A tick, the sentence that says what was read, and one way on.
 * Home and the Following feed both end with it.
 */
export function CaughtUp({ line, action, style }: { line: string; action?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ alignItems: 'center', gap: 6, marginHorizontal: 30 }, style]}>
      <View style={{ width: 54, height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>
        <Check size={26} color={colors.ok} strokeWidth={2.6} />
      </View>
      <Txt variant="subtitle" accessibilityRole="header" center style={{ marginTop: 4 }}>
        {words.journeys.caughtUp}
      </Txt>
      <Txt variant="callout" color="muted" center>
        {line}
      </Txt>
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}
