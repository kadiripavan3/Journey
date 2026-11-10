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
import { words } from '@/words';

const CARDS = [
  { photo: require('@/assets/photos/bromo.jpg'), label: words.signIn.howItWorks.cards.bromo, left: 96, top: 30, rotate: '10deg' },
  { photo: require('@/assets/photos/market.jpg'), label: words.signIn.howItWorks.cards.hoiAn, left: -96, top: 30, rotate: '-11deg' },
  { photo: require('@/assets/photos/scooters.jpg'), label: words.signIn.howItWorks.cards.hanoi, left: 0, top: 58, rotate: '-2deg' },
] as const;

/** 1.2 How it works: one picture explains the idea. A journey is a stack of days that people follow. */
export default function HowItWorks() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  return (
    <Screen header={<AppBar />} footer={<Button label={words.common.next} size="lg" block onPress={() => router.push('/sign-in')} />}>
      <View accessible accessibilityLabel={words.signIn.howItWorks.picture} style={{ height: 430, alignItems: 'center' }}>
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
            {words.signIn.howItWorks.followerCount}
          </Txt>
          <Txt variant="caption" weight={500} color="muted">
            {words.signIn.howItWorks.followingAlong}
          </Txt>
        </View>
      </View>
      <Heading center>{words.signIn.howItWorks.title}</Heading>
      <Lead center>{words.signIn.howItWorks.body}</Lead>
    </Screen>
  );
}
