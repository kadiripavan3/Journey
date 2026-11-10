import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { updateJourney, useGetJourney } from '@/api/generated/journey';
import { type LocalPhoto, uploadPhoto } from '@/api/upload';
import { DetailsForm, type JourneyDetails } from '@/features/journeys/DetailsForm';
import { parseTags } from '@/features/journeys/draft';
import { visibility as visibilityWords } from '@/features/journeys/visibility';
import { VisibilitySheet } from '@/features/journeys/VisibilitySheet';
import { useLeave } from '@/features/navigation/useLeave';
import { today } from '@/lib/dates';
import { AppBar, BarLink } from '@/ui/AppBar';
import { FieldButton } from '@/ui/Field';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { Screen } from '@/ui/Screen';
import { words } from '@/words';

/** Change a journey's details after it has started: the same form as when it was made, and who can see it. */
export default function EditJourney() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leave = useLeave();
  const cache = useCache();
  const journey = useGetJourney(id);
  const j = journey.data;

  const [filled, setFilled] = useState(false);
  const [details, setDetails] = useState<JourneyDetails>({ title: '', description: '', tags: '', startDate: today(), category: null });
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [cover, setCover] = useState<LocalPhoto | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  if (j && !filled) {
    setFilled(true);
    setDetails({ title: j.title, description: j.description, tags: j.tags.join(' '), startDate: j.startDate, category: j.category });
    setVisibility(j.visibility);
  }

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const coverMediaId = cover ? await uploadPhoto(cover) : undefined;
      const saved = await updateJourney(id, {
        title: details.title.trim(),
        description: details.description.trim(),
        tags: parseTags(details.tags),
        startDate: details.startDate,
        category: details.category ?? undefined,
        visibility,
        coverMediaId,
      });
      await cache.journeyChanged(saved);
      leave();
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
          title={words.journey.edit.title}
          left={<BarLink label={words.common.cancel} quiet onPress={leave} />}
          trailing={<BarLink label={saving ? words.common.saving : words.common.save} disabled={!filled || saving || details.title.trim().length === 0} onPress={() => void save()} />}
        />
      }>
      {journey.isPending ? (
        <View style={{ height: 240 }}>
          <Loading offline={journey.isPaused} />
        </View>
      ) : journey.isError && !journey.data ? (
        <View style={{ height: 280 }}>
          <Problem message={messageFor(journey.error)} onRetry={() => void journey.refetch()} retrying={journey.isFetching} />
        </View>
      ) : (
        <>
          <View style={{ height: 10 }} />
          <DetailsForm
            value={details}
            onChange={(patch) => setDetails((now) => ({ ...now, ...patch }))}
            coverUri={cover?.uri ?? j?.coverUrl}
            onCover={setCover}
            problem={failure ? messageFor(failure) : null}
            dayTitle={words.journey.edit.dayTitle}
          >
            <FieldButton label={words.journey.edit.whoCanSee} value={visibilityWords(visibility).label} onPress={() => setChoosing(true)} />
          </DetailsForm>
        </>
      )}
      <VisibilitySheet visible={choosing} onClose={() => setChoosing(false)} title={words.journeys.whoCanSee} value={visibility} onChange={setVisibility} />
    </Screen>
  );
}
