import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Heading, Lead } from '@/ui/Heading';
import { Pill } from '@/ui/Pill';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

const CARDS = [
  { photo: require('@/assets/photos/bromo.jpg'), label: 'Day 22 · Mount Bromo', left: 96, top: 30, rotate: '10deg' },
  { photo: require('@/assets/photos/market.jpg'), label: 'Day 14 · Hoi An', left: -96, top: 30, rotate: '-11deg' },
  { photo: require('@/assets/photos/scooters.jpg'), label: 'Day 1 · Hanoi', left: 0, top: 58, rotate: '-2deg' },
] as const;

/** 1.2 How it works: one picture explains the idea. A journey is a stack of days that people follow. */
export default function HowItWorks() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  return (
    <Screen header={<AppBar />} footer={<Button label="Next" size="lg" block onPress={() => router.push('/sign-in')} />}>
      <View accessible accessibilityLabel="Three photos stacked like cards: Day 1 in Hanoi, Day 14 in Hoi An and Day 22 at Mount Bromo." style={{ height: 430, alignItems: 'center' }}>
        {CARDS.map((card, index) => (
          <Animated.View
            key={card.label}
            entering={FadeInDown.duration(420).delay(120 + index * 140)}
            style={{
              position: 'absolute',
              top: card.top,
              width: 226,
              height: 312,
              borderRadius: radius.stage,
              overflow: 'hidden',
              backgroundColor: colors.fill,
              boxShadow: shadow.stage,
              transform: [{ translateX: card.left }, { rotate: card.rotate }],
            }}>
            <Image source={card.photo} style={{ flex: 1 }} contentFit="cover" />
            <Pill label={card.label} style={{ position: 'absolute', left: 12, bottom: 12 }} />
          </Animated.View>
        ))}
        <View
          style={{
            position: 'absolute',
            bottom: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: radius.cardLarge,
            backgroundColor: colors.surface,
            boxShadow: shadow.md,
          }}>
          <Txt variant="caption" weight={800}>
            1.2k
          </Txt>
          <Txt variant="caption" weight={500} color="muted">
            following along
          </Txt>
        </View>
      </View>
      <Heading center>A story, told day by day</Heading>
      <Lead center>Start a journey, add entries as it happens, and people follow along for the next chapter.</Lead>
    </Screen>
  );
}
