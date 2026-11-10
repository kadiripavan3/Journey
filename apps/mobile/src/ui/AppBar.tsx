import { useRouter } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '@/theme';

import { RoundButton } from './RoundButton';
import { Txt } from './Txt';

type Props = {
  title?: string;
  subtitle?: string;
  /** "back" shows an arrow, "close" a cross, "none" leaves the space empty. */
  leading?: 'back' | 'close' | 'none';
  /** Shown at the left edge instead of the back arrow, such as a Cancel link. */
  left?: ReactNode;
  /** Shown at the right edge, such as a Save button. */
  trailing?: ReactNode;
  /** Shown in the middle instead of a title, such as step progress. */
  center?: ReactNode;
};

/** The bar at the top of a screen: a way back, an optional title, and an optional action. */
export function AppBar({ title, subtitle, leading = 'back', left, trailing, center }: Props) {
  const router = useRouter();
  return (
    <View style={{ height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
      <View style={{ minWidth: 40, alignItems: 'flex-start' }}>
        {left ?? (leading === 'none' ? null : (
          <RoundButton
            label={leading === 'back' ? 'Back' : 'Close'}
            onPress={() => router.back()}
            icon={(c) => (leading === 'back' ? <ArrowLeft size={20} color={c} /> : <X size={20} color={c} />)}
          />
        ))}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>
        {center ?? (
          <>
            {title ? (
              <Txt accessibilityRole="header" numberOfLines={1} weight={800} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.3 }}>
                {title}
              </Txt>
            ) : null}
            {subtitle ? (
              <Txt variant="caption" color="muted" numberOfLines={1} style={{ fontSize: 12, lineHeight: 16 }}>
                {subtitle}
              </Txt>
            ) : null}
          </>
        )}
      </View>
      <View style={{ minWidth: 40, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}

/** Three bars showing how far through a short flow the person is. */
export function StepProgress({ step, of = 3 }: { step: number; of?: number }) {
  return (
    <View accessible accessibilityLabel={`Step ${step} of ${of}`} style={{ flexDirection: 'row', gap: 6, width: 170 }}>
      {Array.from({ length: of }, (_, i) => (
        <StepBar key={i} on={i < step} />
      ))}
    </View>
  );
}

function StepBar({ on }: { on: boolean }) {
  const { colors } = useTheme();
  return <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: on ? colors.accent : colors.fill2 }} />;
}

/** A text action in the bar, such as Save or Cancel. */
export function BarLink({ label, onPress, quiet, disabled }: { label: string; onPress?: () => void; quiet?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: !!disabled }} disabled={disabled} hitSlop={10} onPress={onPress}>
      <Txt weight={800} style={{ fontSize: 15, lineHeight: 20, color: quiet ? colors.muted : colors.accentText, opacity: disabled ? 0.4 : 1 }}>
        {label}
      </Txt>
    </Pressable>
  );
}
