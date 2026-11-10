import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, messageFor } from '@/api/fetcher';
import { getGetMeQueryKey, useCheckUsername, useGetMe, useSaveProfile } from '@/api/generated/journey';
import { useOnboarding } from '@/auth/onboarding';
import { useSession } from '@/auth/session';
import { useDebounced } from '@/lib/useDebounced';
import { initials, normalizeUsername, usernameProblem } from '@/lib/username';
import { radius, useTheme } from '@/theme';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 2.1 Create your profile: step 1 of 3. A name and a username people recognise. The username is checked as you type. */
export default function CreateProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useSession();
  const onboarding = useOnboarding();
  const queryClient = useQueryClient();
  // Coming back from the next step, the profile already exists and this screen edits it.
  const existing = useGetMe().data?.profile;
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [rawUsername, setRawUsername] = useState(existing?.username ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');

  const username = normalizeUsername(rawUsername);
  const localProblem = username ? usernameProblem(username) : null;
  const settled = useDebounced(username);
  const check = useCheckUsername(settled, { query: { enabled: settled.length >= 3 && !usernameProblem(settled) } });
  const checked = settled === username && check.data?.username === username ? check.data : undefined;

  const save = useSaveProfile({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        router.push('/interests');
      },
    },
  });
  const failed = save.error instanceof ApiError ? save.error : null;
  const usernameError =
    localProblem ?? (checked && !checked.available ? checked.reason : null) ?? (failed && failed.code !== 'invalid_input' ? failed.message : failed?.fields.username) ?? null;
  const canContinue = displayName.trim().length > 0 && username.length >= 3 && !localProblem && checked?.available !== false;

  return (
    <Screen
      header={<AppBar leading="none" center={<StepProgress step={1} />} />}
      footer={
        <>
          {save.isError && !failed ? (
            <Txt variant="caption" color="danger" center>
              {messageFor(save.error)}
            </Txt>
          ) : null}
          <Button
            label="Continue"
            size="lg"
            block
            disabled={!canContinue}
            loading={save.isPending}
            onPress={() => {
              onboarding.begin(); // stay in the sign-up steps once the profile exists
              save.mutate({ data: { displayName: displayName.trim(), username, bio: bio.trim() } });
            }}
          />
          <Button label="Use a different email" variant="quiet" block onPress={() => void session.signOut()} />
        </>
      }>
      <Heading style={{ marginTop: 6 }}>Create your profile</Heading>
      <Lead>This is how people see you when you share a journey.</Lead>

      <View
        accessible={false}
        style={{ alignSelf: 'center', width: 104, height: 104, borderRadius: radius.pill, marginVertical: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill2 }}>
        <Txt variant="display">
          {initials(displayName) || ' '}
        </Txt>
      </View>

      <View style={{ gap: 12 }}>
        <Field
          label="Name"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          maxLength={50}
          returnKeyType="next"
          error={failed?.fields.displayName}
        />
        <Field
          label="Username"
          prefix="@"
          value={rawUsername}
          onChangeText={(text) => setRawUsername(text.replace(/\s/g, '').toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={21}
          returnKeyType="next"
          error={usernameError}
          note={checked?.available ? `${username} is available` : null}
          noteTone="ok"
          accessory={checked?.available && !usernameError ? <Check size={18} color={colors.ok} strokeWidth={2.6} /> : null}
        />
        <Field label="Bio · optional" value={bio} onChangeText={setBio} multiline maxLength={150} error={failed?.fields.bio} />
      </View>
    </Screen>
  );
}
