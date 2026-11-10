import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Mail, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { authMode } from '@/auth/mode';
import { layout, radius, useTheme } from '@/theme';
import { AppleLogo, BrandMark, GoogleLogo } from '@/ui/Brand';
import { Button } from '@/ui/Button';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

/** 1.3 Log in or sign up: one screen for both. Apple first, as the App Store asks when Google is offered. */
export default function SignIn() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [note, setNote] = useState<string | null>(null);

  // Apple and Google need their accounts connected. Until then, say so plainly instead of failing.
  const notYet = (name: string) =>
    authMode === 'local' ? () => setNote(`${name} sign-in is switched on later. Use your email for now.`) : undefined;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style="light" />
      <ScrollView bounces={false} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ height: 250 }}>
          <Image source={require('@/assets/photos/sea-cave.jpg')} style={{ flex: 1 }} contentFit="cover" contentPosition={{ top: '70%' }} accessible={false} />
          <View style={{ position: 'absolute', top: insets.top + 8, left: 16 }}>
            <RoundButton label="Close" tone="photo" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
          </View>
        </View>
        <View style={{ flex: 1, marginTop: -30, paddingTop: 50, paddingBottom: insets.bottom + 16, borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, backgroundColor: colors.bg }}>
          <View style={{ position: 'absolute', top: -32, left: 20, borderRadius: radius.cardLarge, borderWidth: 4, borderColor: colors.bg }}>
            <BrandMark size={64} />
          </View>
          <View style={{ paddingHorizontal: layout.rowGutter, gap: 10 }}>
            <Txt variant="heading" accessibilityRole="header">
              Log in or sign up
            </Txt>
            <Txt variant="lead" color="muted">
              Use an account you already have. There&apos;s no password to remember.
            </Txt>
          </View>
          <View style={{ paddingHorizontal: layout.rowGutter, gap: 10, marginTop: 24 }}>
            <Button label="Continue with Apple" size="lg" variant="ink" block onPress={notYet('Apple')} icon={(c) => <AppleLogo color={c} />} />
            <Button label="Continue with Google" size="lg" variant="line" block onPress={notYet('Google')} icon={() => <GoogleLogo />} />
            <Button label="Continue with email" size="lg" variant="line" block onPress={() => router.push('/email')} icon={(c) => <Mail size={19} color={c} />} />
            {note ? (
              <View accessibilityLiveRegion="polite" style={{ padding: 13, borderRadius: radius.field, backgroundColor: colors.fill }}>
                <Txt variant="caption" weight={600}>
                  {note}
                </Txt>
              </View>
            ) : null}
          </View>
          <Txt variant="small" color="muted" center weight={500} style={{ marginTop: 18, marginHorizontal: 34 }}>
            By continuing you agree to the Terms and Privacy Policy, and confirm you&apos;re 13 or older.
          </Txt>
        </View>
      </ScrollView>
    </View>
  );
}
