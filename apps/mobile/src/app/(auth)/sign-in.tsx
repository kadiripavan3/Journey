import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Mail, X } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, messageFor } from '@/api/fetcher';
import { authMode } from '@/auth/mode';
import { signInService } from '@/auth/signIn';
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

  // Where Apple or Google isn't offered (not connected yet, or not this kind of phone), say so plainly.
  const [busy, setBusy] = useState<string | null>(null);
  const with_ = (name: 'Apple' | 'Google', start: (() => Promise<void>) | null) => () => {
    if (!start) {
      setNote(authMode === 'local' ? `${name} sign-in is switched on later. Use your email for now.` : `${name} sign-in isn't available on this phone. Use your email.`);
      return;
    }
    setNote(null);
    setBusy(name);
    start()
      .catch((error: unknown) => {
        if (!(error instanceof ApiError && error.code === 'cancelled')) setNote(messageFor(error));
      })
      .finally(() => setBusy(null));
  };

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
            <Button label="Continue with Apple" size="lg" variant="ink" block loading={busy === 'Apple'} onPress={with_('Apple', signInService.apple)} icon={(c) => <AppleLogo color={c} />} />
            <Button label="Continue with Google" size="lg" variant="line" block loading={busy === 'Google'} onPress={with_('Google', signInService.google)} icon={() => <GoogleLogo />} />
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
