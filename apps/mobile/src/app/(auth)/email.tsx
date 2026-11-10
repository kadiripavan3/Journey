import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useRequestLocalCode } from '@/api/generated/journey';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { RoundButton } from '@/ui/RoundButton';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

const looksLikeEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** 1.4 Email: asks for one thing, then sends the code. */
export default function Email() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const requestCode = useRequestLocalCode();

  const send = () => {
    const address = email.trim();
    requestCode.mutate({ data: { email: address } }, { onSuccess: () => router.push({ pathname: '/code', params: { email: address } }) });
  };

  return (
    <Screen
      header={
        <View style={{ height: 56, paddingHorizontal: 16, justifyContent: 'center' }}>
          <RoundButton label="Back" onPress={() => router.back()} icon={(c) => <ArrowLeft size={20} color={c} />} />
        </View>
      }
      footer={<Button label="Send code" size="lg" block disabled={!looksLikeEmail(email)} loading={requestCode.isPending} onPress={send} />}>
      <Txt accessibilityRole="header" weight={800} style={{ fontSize: 31, lineHeight: 34, letterSpacing: -1.2, marginTop: 6 }}>
        What&apos;s your email?
      </Txt>
      <Txt color="muted" style={{ fontSize: 15.5, lineHeight: 23, marginTop: 10, marginBottom: 24 }}>
        We&apos;ll send a 6-digit code to sign you in. No password needed.
      </Txt>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={() => looksLikeEmail(email) && send()}
        error={requestCode.isError ? messageFor(requestCode.error) : null}
      />
    </Screen>
  );
}
