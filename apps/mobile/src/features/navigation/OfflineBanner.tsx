import { usePathname } from 'expo-router';
import { WifiOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import Animated, { FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useOnline } from '@/api/online';
import { radius, useTheme } from '@/theme';
import { Txt } from '@/ui/Txt';

/** How long the banner says everything, before it shrinks to a small mark that stays until the phone is back. */
const WIDE_FOR = 5000;

/** Screens that say "you're offline" in their own words, with what it means there. The floating mark would only say it twice. */
const SAYS_SO_ITSELF = [/^\/uploads$/, /^\/journey\/[^/]+\/add$/];

/** 13.2 Offline: a calm banner says what still works. It appears when the phone loses its connection and goes when it is back. */
export function OfflineBanner() {
  const online = useOnline();
  const path = usePathname();
  if (online || SAYS_SO_ITSELF.some((screen) => screen.test(path))) return null;
  return <Banner />;
}

function Banner() {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setWide(false), WIDE_FOR);
    return () => clearTimeout(timer);
  }, []);
  return (
    <Animated.View
      entering={FadeInUp.duration(240)}
      exiting={FadeOutUp.duration(200)}
      layout={LinearTransition.duration(220)}
      accessibilityRole="alert"
      accessibilityLabel="You're offline. Showing what you read recently."
      // It sits under the top bar, as designed, and lets taps through: Back, Post and Close stay in reach.
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: insets.top + 60,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: wide ? 10 : 6,
        paddingVertical: wide ? 10 : 6,
        paddingHorizontal: wide ? 16 : 12,
        borderRadius: radius.cardLarge,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.line,
        boxShadow: shadow.md,
      }}>
      <WifiOff size={wide ? 18 : 15} color={colors.warn} />
      {wide ? (
        <Txt variant="note" weight={700}>
          You&apos;re offline
          <Txt variant="note" color="muted">
            {'  '}Showing what you read recently
          </Txt>
        </Txt>
      ) : (
        <Txt variant="footnote" weight={700}>
          Offline
        </Txt>
      )}
    </Animated.View>
  );
}
