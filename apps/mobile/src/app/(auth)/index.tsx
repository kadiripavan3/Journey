import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandMark } from '@/ui/Brand';
import { Button } from '@/ui/Button';
import { Txt } from '@/ui/Txt';

/** 1.1 Welcome: one full-bleed photo and one promise. Always dark, so the photo leads. */
export default function Welcome() {
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: '#08080A' }}>
      <StatusBar style="light" />
      <Image source={require('@/assets/photos/welcome.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
      <LinearGradient
        colors={['rgba(8,8,10,0.45)', 'rgba(8,8,10,0)', 'rgba(8,8,10,0)', 'rgba(8,8,10,0.8)', 'rgba(8,8,10,0.95)']}
        locations={[0, 0.2, 0.38, 0.66, 1]}
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={{ flex: 1, justifyContent: 'space-between', paddingHorizontal: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 12 }}>
          <BrandMark size={36} />
          <Txt color="onPhoto" weight={800} style={{ fontSize: 21, lineHeight: 26, letterSpacing: -0.6 }}>
            Journey
          </Txt>
        </View>
        <View style={{ gap: 12, paddingBottom: 12 }}>
          <Txt accessibilityRole="header" color="onPhoto" weight={800} style={{ fontSize: 41, lineHeight: 42, letterSpacing: -1.6 }}>
            Follow the journey, not just the moment.
          </Txt>
          <Txt color="onPhoto" style={{ fontSize: 16, lineHeight: 23, opacity: 0.84, marginBottom: 10 }}>
            Trips, challenges and everything in between, told day by day.
          </Txt>
          <Button label="Get started" size="lg" block onPress={() => router.push('/how-it-works')} />
          <Button label="I already have an account" size="lg" variant="glass" block onPress={() => router.push('/sign-in')} />
          <Txt variant="caption" color="onPhoto" center weight={500} style={{ fontSize: 11.5, opacity: 0.62, marginTop: 2 }}>
            By continuing you agree to the Terms and Privacy Policy.
          </Txt>
        </View>
      </SafeAreaView>
    </View>
  );
}
