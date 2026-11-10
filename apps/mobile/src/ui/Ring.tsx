import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useTheme } from '@/theme';

import { Txt } from './Txt';

/** A progress ring around an emoji: how far through a challenge someone is. */
export function Ring({ progress, emoji, size = 62 }: { progress: number; emoji: string; size?: number }) {
  const { colors } = useTheme();
  const stroke = 6;
  const r = (size - stroke) / 2;
  const around = 2 * Math.PI * r;
  const done = Math.max(0, Math.min(1, progress));
  return (
    <View accessible={false} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.fill2} strokeWidth={stroke} fill="none" />
        {done > 0 ? (
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.accent} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${around * done} ${around}`} />
        ) : null}
      </Svg>
      <Txt style={{ fontSize: 24, lineHeight: 30 }}>{emoji}</Txt>
    </View>
  );
}
