import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Camera, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ApiError, messageFor } from '@/api/fetcher';
import { saveProfile, useCheckUsername, useGetMe } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { type LocalPhoto, uploadPhoto } from '@/api/upload';
import { useCatalog } from '@/features/journeys/catalog';
import { pickSquarePhoto } from '@/features/media/pick';
import { useDebounced } from '@/lib/useDebounced';
import { normalizeUsername, usernameProblem } from '@/lib/username';
import { radius, useTheme } from '@/theme';
import { AppBar, BarLink } from '@/ui/AppBar';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Field } from '@/ui/Field';
import { GroupLabel } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 9.3 Edit profile: photo, name, username, a short bio and one link, plus the interests that shape Discover. */
export default function EditProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const refresh = useRefreshAll();
  const profile = useGetMe().data?.profile;

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [rawUsername, setRawUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [link, setLink] = useState(profile?.link ?? '');
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  const username = normalizeUsername(rawUsername);
  const localProblem = username ? usernameProblem(username) : null;
  const settled = useDebounced(username);
  const changed = username !== profile?.username;
  const check = useCheckUsername(settled, { query: { enabled: changed && settled.length >= 3 && !usernameProblem(settled) } });
  const checked = changed && settled === username && check.data?.username === username ? check.data : undefined;
  const failed = failure instanceof ApiError ? failure : null;
  const usernameError = localProblem ?? (checked && !checked.available ? checked.reason : null) ?? failed?.fields.username ?? null;
  const canSave = displayName.trim().length > 0 && username.length >= 3 && !localProblem && checked?.available !== false;
  const picture = photo ? photo.uri : removePhoto ? null : profile?.avatarUrl;

  const choosePhoto = async () => {
    try {
      const picked = await pickSquarePhoto();
      if (picked) {
        setPhoto(picked);
        setRemovePhoto(false);
      }
    } catch {
      setFailure(new ApiError(0, 'photos', "We couldn't open your photos. Check that Journey may see them in the phone's Settings."));
    }
  };

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const avatarMediaId = photo ? await uploadPhoto(photo) : undefined;
      await saveProfile({ displayName: displayName.trim(), username, bio: bio.trim(), link: link.trim(), interests, avatarMediaId, removeAvatar: removePhoto && !photo });
      await refresh();
      router.back();
    } catch (error) {
      setFailure(error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={
        <AppBar
          title="Edit profile"
          left={<BarLink label="Cancel" quiet onPress={() => router.back()} />}
          trailing={<BarLink label={saving ? 'Saving…' : 'Save'} disabled={!canSave || saving} onPress={() => void save()} />}
        />
      }>
      <View style={{ alignItems: 'center', marginTop: 16, marginBottom: 18, gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={picture ? 'Change your photo' : 'Add a photo'} onPress={() => void choosePhoto()}>
          {photo ? (
            <Image source={{ uri: photo.uri }} style={{ width: 104, height: 104, borderRadius: radius.pill, backgroundColor: colors.fill2 }} contentFit="cover" />
          ) : (
            <Avatar uri={picture} name={displayName || ' '} size={104} />
          )}
          <View style={{ position: 'absolute', right: -2, bottom: 0, width: 36, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.text, borderWidth: 3, borderColor: colors.bg }}>
            <Camera size={16} color={colors.bg} />
          </View>
        </Pressable>
        {picture ? (
          <Button
            label="Remove photo"
            variant="quiet"
            size="sm"
            onPress={() => {
              setPhoto(null);
              setRemovePhoto(true);
            }}
            style={{ alignSelf: 'center' }}
          />
        ) : null}
      </View>

      {failure && !(failed && Object.keys(failed.fields).length > 0) ? (
        <Txt variant="caption" color="danger" center accessibilityLiveRegion="polite" style={{ marginBottom: 12 }}>
          {messageFor(failure)}
        </Txt>
      ) : null}

      <View style={{ gap: 12 }}>
        <Field label="Name" value={displayName} onChangeText={setDisplayName} autoComplete="name" autoCapitalize="words" maxLength={50} error={failed?.fields.displayName} />
        <Field
          label="Username"
          prefix="@"
          value={rawUsername}
          onChangeText={(text) => setRawUsername(text.replace(/\s/g, '').toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={21}
          error={usernameError}
          note={checked?.available ? `${username} is available` : null}
          noteTone="ok"
          accessory={checked?.available && !usernameError ? <Check size={18} color={colors.ok} strokeWidth={2.6} /> : null}
        />
        <Field label={`Bio · ${bio.length} of 150`} value={bio} onChangeText={setBio} multiline maxLength={150} error={failed?.fields.bio} />
        <Field label="Link" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={200} placeholder="yoursite.com" error={failed?.fields.link} />
      </View>

      <GroupLabel>Interests</GroupLabel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
        {catalog.interests.map((interest) => (
          <Chip
            key={interest.id}
            label={interest.label}
            emoji={interest.emoji}
            selected={interests.includes(interest.id)}
            onPress={() => setInterests((now) => (now.includes(interest.id) ? now.filter((x) => x !== interest.id) : [...now, interest.id]))}
          />
        ))}
      </View>
    </Screen>
  );
}
