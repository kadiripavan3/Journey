import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, Camera, Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { ApiError, messageFor } from '@/api/fetcher';
import { updateJourney, useGetJourney } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { type LocalPhoto, uploadPhoto } from '@/api/upload';
import { useCatalog } from '@/journey/catalog';
import { parseTags } from '@/journey/draft';
import { pickPhotos } from '@/journey/pick';
import { addDays, formatDayLong, today } from '@/lib/dates';
import { useTheme } from '@/theme';
import { AppBar, BarLink } from '@/ui/AppBar';
import { Loading, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { DayPicker } from '@/ui/DayPicker';
import { Field, FieldButton } from '@/ui/Field';
import { Screen } from '@/ui/Screen';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

const VISIBILITY = [
  { id: 'public', label: 'Public', note: 'Anyone. It can appear in Discover.' },
  { id: 'unlisted', label: 'Unlisted', note: 'Only people with the link.' },
  { id: 'private', label: 'Private', note: 'Only you.' },
] as const;

/** Change a journey's details after it has started: the same fields as when it was made. */
export default function EditJourney() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const refresh = useRefreshAll();
  const journey = useGetJourney(id);
  const j = journey.data;

  const [filled, setFilled] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [startDate, setStartDate] = useState(today());
  const [category, setCategory] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'unlisted' | 'private'>('public');
  const [cover, setCover] = useState<LocalPhoto | null>(null);
  const [picking, setPicking] = useState<'day' | 'category' | 'visibility' | null>(null);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);

  if (j && !filled) {
    setFilled(true);
    setTitle(j.title);
    setDescription(j.description);
    setTags(j.tags.join(' '));
    setStartDate(j.startDate);
    setCategory(j.category);
    setVisibility(j.visibility);
  }

  const save = async () => {
    setSaving(true);
    setFailure(null);
    try {
      const coverMediaId = cover ? await uploadPhoto(cover) : undefined;
      await updateJourney(id, { title: title.trim(), description: description.trim(), tags: parseTags(tags), startDate, category, visibility, coverMediaId });
      await refresh();
      router.back();
    } catch (error) {
      setFailure(error);
    } finally {
      setSaving(false);
    }
  };
  const chooseCover = async () => {
    try {
      const [photo] = await pickPhotos(1);
      if (photo) setCover(photo);
    } catch {
      setFailure(new ApiError(0, 'photos', "We couldn't open your photos. Check that Journey may see them in the phone's Settings."));
    }
  };

  const shownCover = cover?.uri ?? j?.coverUrl;
  const chosenCategory = catalog.category(category);
  const chosenVisibility = VISIBILITY.find((v) => v.id === visibility) ?? VISIBILITY[0];

  return (
    <Screen
      header={
        <AppBar
          title="Edit journey"
          left={<BarLink label="Cancel" quiet onPress={() => router.back()} />}
          trailing={<BarLink label={saving ? 'Saving…' : 'Save'} disabled={!filled || saving || title.trim().length === 0} onPress={() => void save()} />}
        />
      }>
      {journey.isPending ? (
        <View style={{ height: 240 }}>
          <Loading />
        </View>
      ) : journey.isError ? (
        <View style={{ height: 280 }}>
          <Problem error={journey.error} onRetry={() => void journey.refetch()} retrying={journey.isRefetching} />
        </View>
      ) : (
        <>
          <View style={{ height: 168, marginTop: 10, marginBottom: 16, borderRadius: 22, overflow: 'hidden', backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
            {shownCover ? <Image source={{ uri: shownCover }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessibilityLabel="The journey's cover" /> : null}
            <View style={shownCover ? { position: 'absolute', right: 12, bottom: 12 } : undefined}>
              <Button label={shownCover ? 'Change cover' : 'Add a cover'} size="sm" variant={shownCover ? 'glass' : 'soft'} icon={(c) => <Camera size={16} color={c} />} onPress={() => void chooseCover()} />
            </View>
          </View>
          {failure ? (
            <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginBottom: 12 }}>
              {messageFor(failure)}
            </Txt>
          ) : null}
          <View style={{ gap: 12 }}>
            <Field label="Title" value={title} onChangeText={setTitle} maxLength={80} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <FieldButton label="Starts" value={formatDayLong(startDate)} icon={<CalendarDays size={18} color={colors.text} />} onPress={() => setPicking('day')} />
              <FieldButton label="Category" value={chosenCategory ? `${chosenCategory.emoji} ${chosenCategory.label}` : 'Choose'} onPress={() => setPicking('category')} />
            </View>
            <Field label="What's it about? · optional" value={description} onChangeText={setDescription} multiline maxLength={300} />
            <Field label="Tags · up to 5" value={tags} onChangeText={setTags} autoCapitalize="none" autoCorrect={false} note="Separate tags with spaces." />
            <FieldButton label="Who can see it" value={chosenVisibility.label} onPress={() => setPicking('visibility')} />
          </View>
        </>
      )}

      <DayPicker visible={picking === 'day'} onClose={() => setPicking(null)} title="When did it start?" value={startDate} onChange={setStartDate} min={addDays(today(), -365 * 5)} max={addDays(today(), 365)} />
      <Sheet visible={picking === 'category'} onClose={() => setPicking(null)} title="Category">
        {catalog.categories.map((c, index) => (
          <SheetRow
            key={c.id}
            first={index === 0}
            label={`${c.emoji}  ${c.label}`}
            trailing={c.id === category ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : undefined}
            onPress={() => {
              setCategory(c.id);
              setPicking(null);
            }}
          />
        ))}
      </Sheet>
      <Sheet visible={picking === 'visibility'} onClose={() => setPicking(null)} title="Who can see it?">
        {VISIBILITY.map((v, index) => (
          <SheetRow
            key={v.id}
            first={index === 0}
            label={v.label}
            note={v.note}
            trailing={v.id === visibility ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : undefined}
            onPress={() => {
              setVisibility(v.id);
              setPicking(null);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
