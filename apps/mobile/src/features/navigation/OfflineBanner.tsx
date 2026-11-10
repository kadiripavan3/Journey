import { useNetworkState } from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, useTheme } from '@/theme';
import { Txt } from '@/ui/Txt';

/** 13.2 Offline: a calm banner says what still works. It appears when the phone loses its connection and goes when it is back. */
export function OfflineBanner() {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const network = useNetworkState();
  // Unknown (still being worked out) counts as connected: the banner only shows when the phone says it is offline.
  if (network.isConnected !== false) return null;
  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(200)}
      accessibilityRole="alert"
      style={{
        position: 'absolute',
        top: insets.top + 6,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: radius.cardLarge,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        boxShadow: shadow.md,
      }}>
      <WifiOff size={18} color={colors.warn} />
      <Txt variant="note" weight={700}>
        You&apos;re offline
        <Txt variant="note" color="muted">
          {'  '}Showing what you read recently
        </Txt>
      </Txt>
    </Animated.View>
  );
}
