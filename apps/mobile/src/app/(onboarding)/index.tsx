import { useQueryClient } from '@tanstack/react-query';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, messageFor } from '@/api/fetcher';
import { getGetMeQueryKey, useCheckUsername, useSaveProfile } from '@/api/generated/journey';
import { useSession } from '@/auth/session';
import { useDebounced } from '@/lib/useDebounced';
import { initials, normalizeUsername, usernameProblem } from '@/lib/username';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 2.1 Create your profile: a name and a username people recognise. The username is checked as you type. */
export default function CreateProfile() {
  const { colors } = useTheme();
  const session = useSession();
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [rawUsername, setRawUsername] = useState('');
  const [bio, setBio] = useState('');

  const username = normalizeUsername(rawUsername);
  const localProblem = username ? usernameProblem(username) : null;
  const settled = useDebounced(username);
  const check = useCheckUsername(settled, { query: { enabled: settled.length >= 3 && !usernameProblem(settled) } });
  const checked = settled === username && check.data?.username === username ? check.data : undefined;

  const save = useSaveProfile({
    mutation: { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() }) },
  });
  const failed = save.error instanceof ApiError ? save.error : null;
  const usernameError =
    localProblem ?? (checked && !checked.available ? checked.reason : null) ?? (failed && failed.code !== 'invalid_input' ? failed.message : failed?.fields.username) ?? null;
  const canContinue = displayName.trim().length > 0 && username.length >= 3 && !localProblem && checked?.available !== false;

  return (
    <Screen
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
            onPress={() => save.mutate({ data: { displayName: displayName.trim(), username, bio: bio.trim() } })}
          />
          <Button label="Use a different email" variant="quiet" block onPress={() => void session.signOut()} />
        </>
      }>
      <Txt accessibilityRole="header" weight={800} style={{ fontSize: 31, lineHeight: 34, letterSpacing: -1.2, marginTop: 28 }}>
        Create your profile
      </Txt>
      <Txt color="muted" style={{ fontSize: 15.5, lineHeight: 23, marginTop: 10 }}>
        This is how people see you when you share a journey.
      </Txt>

      <View
        accessible={false}
        style={{ alignSelf: 'center', width: 104, height: 104, borderRadius: 52, marginVertical: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill2 }}>
        <Txt weight={800} style={{ fontSize: 34, lineHeight: 40, letterSpacing: -1 }}>
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
