import { useEffect } from 'react';
import { type DimensionValue, type StyleProp, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme';

/**
 * 13.1 Loading: grey shapes in the screen's own layout while content loads, never a spinner on a blank page.
 * The shapes breathe softly; with Reduce Motion on they stay still.
 */
export function Sk({ width, height, radius = 12, style }: { width?: DimensionValue; height: DimensionValue; radius?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const glow = useSharedValue(1);
  useEffect(() => {
    glow.set(withRepeat(withTiming(0.5, { duration: 800 }), -1, true));
  }, [glow]);
  const breathing = useAnimatedStyle(() => ({ opacity: glow.get() }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.fill2 }, breathing, style]} />;
}

/** Photo cards in a row, as on Home and Discover. */
export function RailSkeleton({ size = 232, count = 2 }: { size?: number; count?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ marginTop: 24 }}>
      <Sk width={210} height={22} style={{ marginLeft: 20, marginBottom: 14 }} />
      <View style={{ flexDirection: 'row', gap: 14, paddingHorizontal: 16, overflow: 'hidden' }}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={{ width: size, gap: 8 }}>
            <Sk height={size} radius={20} />
            <Sk width="80%" height={14} />
            <Sk width="55%" height={12} />
          </View>
        ))}
      </View>
    </View>
  );
}

/** Rows with a small picture and two lines, as in lists of journeys, people and Activity. */
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ paddingTop: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 20 }}>
          <Sk width={56} height={56} radius={16} />
          <View style={{ flex: 1, gap: 8 }}>
            <Sk width="70%" height={14} />
            <Sk width="45%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Cards with a wide photo, as in the Following feed and the story line. */
export function CardSkeleton({ count = 2 }: { count?: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ paddingHorizontal: 16, paddingTop: 8, gap: 14 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ gap: 10 }}>
          <Sk height={200} radius={20} />
          <Sk width="65%" height={16} />
          <Sk width="90%" height={12} />
        </View>
      ))}
    </View>
  );
}
