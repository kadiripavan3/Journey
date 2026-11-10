import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { useCache } from '@/api/cache';
import { openPage } from '@/api/config';
import { ApiError, messageFor } from '@/api/fetcher';
import { saveProfile, useCheckUsername, useGetMe } from '@/api/generated/journey';
import { type LocalPhoto, uploadPhoto } from '@/api/upload';
import { useOnboarding } from '@/auth/onboarding';
import { useSession } from '@/auth/session';
import { signInService } from '@/auth/signIn';
import { ProfilePhoto } from '@/features/media/ProfilePhoto';
import { useDebounced } from '@/lib/useDebounced';
import { normalizeUsername, usernameProblem } from '@/lib/username';
import { useTheme } from '@/theme';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { CheckRow } from '@/ui/CheckRow';
import { Field } from '@/ui/Field';
import { Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** What the API says when it is the username it won't take. Anything else it refuses is not about the username. */
const USERNAME_REFUSED = ['username_taken', 'invalid_username'];

/** 2.1 Create your profile: step 1 of 3. A face and a name people recognise. The username is checked as you type. */
export default function CreateProfile() {
  const { colors } = useTheme();
  const router = useRouter();
  const session = useSession();
  const onboarding = useOnboarding();
  const cache = useCache();
  // Coming back from the next step, the profile already exists and this screen edits it.
  const existing = useGetMe().data?.profile;
  const [displayName, setDisplayName] = useState(existing?.displayName ?? '');
  const [rawUsername, setRawUsername] = useState(existing?.username ?? '');
  const [bio, setBio] = useState(existing?.bio ?? '');
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  // Asked once, when the profile is made. Journey is for people aged 13 and over.
  const [oldEnough, setOldEnough] = useState(false);

  // A name the sign-in already knows is offered, not asked for again: Apple hands it over once, at the
  // first sign-in. Whatever the person has typed meanwhile stays.
  const isNew = !existing;
  useEffect(() => {
    if (!isNew) return;
    let current = true;
    void signInService
      .suggestedName()
      .catch(() => null)
      .then((name) => {
        if (current && name) setDisplayName((typed) => typed || name.slice(0, 50));
      });
    return () => {
      current = false;
    };
  }, [isNew]);

  const username = normalizeUsername(rawUsername);
  const localProblem = username ? usernameProblem(username) : null;
  const settled = useDebounced(username);
  const check = useCheckUsername(settled, { query: { enabled: settled.length >= 3 && !usernameProblem(settled) } });
  const checked = settled === username && check.data?.username === username ? check.data : undefined;

  const save = useMutation({
    mutationFn: async () => {
      // The photo goes up first; the profile is saved with it.
      const avatarMediaId = photo ? await uploadPhoto(photo) : undefined;
      return saveProfile({ displayName: displayName.trim(), username, bio: bio.trim(), avatarMediaId, ageConfirmed: existing ? undefined : oldEnough });
    },
    onSuccess: async (profile) => {
      await cache.profileSaved(profile);
      router.push('/interests');
    },
  });
  const failed = save.error instanceof ApiError ? save.error : null;
  const usernameRefused = failed && USERNAME_REFUSED.includes(failed.code) ? failed.message : null;
  const usernameError = localProblem ?? (checked && !checked.available ? checked.reason : null) ?? usernameRefused ?? failed?.fields.username ?? null;
  // Whatever else went wrong (no connection, the photo) is said above the button, not under the username.
  const problem = photoProblem ?? (save.isError && !usernameRefused && failed?.code !== 'invalid_input' ? messageFor(save.error) : null);
  const canContinue = displayName.trim().length > 0 && username.length >= 3 && !localProblem && checked?.available !== false && (!!existing || oldEnough);

  return (
    <Screen
      header={<AppBar leading="none" center={<StepProgress step={1} />} />}
      footer={
        <>
          {problem ? (
            <Txt variant="caption" color="danger" center accessibilityLiveRegion="polite">
              {problem}
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
              setPhotoProblem(null);
              save.mutate();
            }}
          />
          <Button label="Use a different email" variant="quiet" block onPress={() => void session.signOut()} />
        </>
      }>
      <Heading style={{ marginTop: 6 }}>Create your profile</Heading>
      <Lead>This is how people see you when you share a journey.</Lead>

      <View style={{ marginTop: 22, marginBottom: 20 }}>
        <ProfilePhoto
          uri={photo?.uri ?? existing?.avatarUrl}
          name={displayName}
          onPicked={(picked) => {
            setPhoto(picked);
            setPhotoProblem(null);
          }}
          onProblem={setPhotoProblem}
        />
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
      {existing ? null : (
        <CheckRow
          label="I'm 13 or older"
          checked={oldEnough}
          onChange={setOldEnough}
          style={{ marginTop: 18 }}
          note={
            <Txt variant="footnote" color="muted">
              By continuing you agree to the{' '}
              <Txt variant="footnote" weight={700} accessibilityRole="link" onPress={() => openPage('/terms')} style={{ color: colors.accentText }}>
                terms
              </Txt>{' '}
              and the{' '}
              <Txt variant="footnote" weight={700} accessibilityRole="link" onPress={() => openPage('/privacy')} style={{ color: colors.accentText }}>
                privacy policy
              </Txt>
              .
            </Txt>
          }
        />
      )}
    </Screen>
  );
}
