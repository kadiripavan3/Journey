import { ActivityIndicator, View } from 'react-native';

import { useTheme } from '@/theme';

/** Shown while a screen's first data is on its way. */
export function Loading() {
  const { colors } = useTheme();
  return (
    <View accessibilityLabel="Loading" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <ActivityIndicator color={colors.muted} />
    </View>
  );
}
