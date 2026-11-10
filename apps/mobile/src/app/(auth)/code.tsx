import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useCreateLocalToken, useRequestLocalCode } from '@/api/generated/journey';
import { authMode, LOCAL_TEST_CODE } from '@/auth/mode';
import { useSession } from '@/auth/session';
import { useTheme } from '@/theme';
import { OtpInput } from '@/ui/OtpInput';
import { RoundButton } from '@/ui/RoundButton';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 1.5 Email code: six boxes, checked as soon as the last digit is in. */
export default function Code() {
  const router = useRouter();
  const { colors } = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const session = useSession();
  const [code, setCode] = useState('');
  const createToken = useCreateLocalToken();
  const resend = useRequestLocalCode();

  const check = (typed: string) =>
    createToken.mutate(
      { data: { email, code: typed } },
      { onSuccess: (result) => void session.signIn(result.accessToken), onError: () => setCode('') },
    );

  return (
    <Screen
      header={
        <View style={{ height: 56, paddingHorizontal: 16, justifyContent: 'center' }}>
          <RoundButton label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
      }>
      <Txt accessibilityRole="header" weight={800} style={{ fontSize: 31, lineHeight: 34, letterSpacing: -1.2, marginTop: 6 }}>
        Check your email
      </Txt>
      <Txt color="muted" style={{ fontSize: 15.5, lineHeight: 23, marginTop: 10, marginBottom: 28 }}>
        Enter the code we sent to{' '}
        <Txt weight={700} style={{ fontSize: 15.5, lineHeight: 23 }}>
          {email}
        </Txt>
        .
      </Txt>
      <OtpInput value={code} onChange={setCode} onComplete={check} disabled={createToken.isPending} />
      {createToken.isError ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginTop: 12 }}>
          {messageFor(createToken.error)}
        </Txt>
      ) : null}
      <Pressable accessibilityRole="button" onPress={() => resend.mutate({ data: { email } })} style={{ marginTop: 18, alignSelf: 'flex-start' }} hitSlop={8}>
        <Txt variant="caption" color="accentText" weight={700} style={{ fontSize: 14, lineHeight: 20 }}>
          {resend.isSuccess ? 'Code sent again' : 'Send the code again'}
        </Txt>
      </Pressable>
      {authMode === 'local' ? (
        <View style={{ marginTop: 24, padding: 13, borderRadius: 16, backgroundColor: colors.fill }}>
          <Txt variant="caption" weight={600}>
            Test mode: no email is sent. The code is {LOCAL_TEST_CODE}.
          </Txt>
        </View>
      ) : null}
    </Screen>
  );
}
