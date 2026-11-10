import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { CalendarDays, Camera, Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useCatalog } from '@/features/journeys/catalog';
import { parseTags, useNewJourney } from '@/features/journeys/draft';
import { pickPhotos } from '@/features/media/pick';
import { addDays, formatDayLong, today } from '@/lib/dates';
import { radius, useTheme } from '@/theme';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { DayPicker } from '@/ui/DayPicker';
import { Emoji } from '@/ui/Emoji';
import { Field, FieldButton } from '@/ui/Field';
import { Heading } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

/** 7.5 Journey details: step 2 of 3. A title and a start date are enough; the first photo is the cover until you choose one. */
export default function JourneyDetails() {
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const { draft, change } = useNewJourney();
  const [pickingDay, setPickingDay] = useState(false);
  const [pickingCategory, setPickingCategory] = useState(false);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);

  const template = catalog.template(draft.template);
  const category = catalog.category(draft.category ?? template?.defaultCategory);
  const tags = parseTags(draft.tags);

  const chooseCover = async () => {
    setPhotoProblem(null);
    try {
      const [photo] = await pickPhotos(1);
      if (photo) change({ cover: photo });
    } catch {
      setPhotoProblem("We couldn't open your photos. Check that Journey may see them in the phone's Settings.");
    }
  };

  return (
    <Screen
      header={<AppBar center={<StepProgress step={2} />} />}
      footer={<Button label="Continue" size="lg" block disabled={draft.title.trim().length === 0} onPress={() => router.push('/new/visibility')} />}>
      <Heading style={{ marginTop: 6 }}>Tell us about it</Heading>

      <View style={{ height: 168, marginTop: 18, marginBottom: 16, borderRadius: radius.cardLarge, overflow: 'hidden', backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
        {draft.cover ? <Image source={{ uri: draft.cover.uri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessibilityLabel="The cover you chose" /> : null}
        {draft.cover ? (
          <View style={{ position: 'absolute', right: 12, bottom: 12 }}>
            <Button label="Change cover" size="sm" variant="glass" icon={(c) => <Camera size={16} color={c} />} onPress={() => void chooseCover()} />
          </View>
        ) : (
          <>
            <Button label="Add a cover" size="sm" variant="soft" icon={(c) => <Camera size={16} color={c} />} onPress={() => void chooseCover()} style={{ alignSelf: 'center', backgroundColor: colors.bg }} />
            <Txt variant="footnote" color="muted" center style={{ marginTop: 8, marginHorizontal: 30 }}>
              Optional. Your first photo is the cover until you choose one.
            </Txt>
          </>
        )}
      </View>
      {photoProblem ? (
        <Txt variant="caption" color="danger" style={{ marginBottom: 12 }}>
          {photoProblem}
        </Txt>
      ) : null}

      <View style={{ gap: 12 }}>
        <Field label="Title" value={draft.title} onChangeText={(title) => change({ title })} maxLength={80} autoCapitalize="sentences" returnKeyType="next" placeholder={template?.id === 'challenge30' ? '30 days of…' : undefined} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <FieldButton label="Starts" value={formatDayLong(draft.startDate)} icon={<CalendarDays size={18} color={colors.text} />} onPress={() => setPickingDay(true)} />
          <FieldButton label="Category" value={category ? category.label : 'Choose'} icon={category ? <Emoji char={category.emoji} size={20} /> : undefined} onPress={() => setPickingCategory(true)} />
        </View>
        <Field label="What's it about? · optional" value={draft.description} onChangeText={(description) => change({ description })} multiline maxLength={300} />
        <Field
          label="Tags · up to 5"
          value={draft.tags}
          onChangeText={(text) => change({ tags: text })}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="iceland roadtrip vanlife"
          note={tags.length > 0 ? tags.map((tag) => `#${tag}`).join('  ') : 'Separate tags with spaces.'}
        />
      </View>

      <DayPicker
        visible={pickingDay}
        onClose={() => setPickingDay(false)}
        title="When does it start?"
        value={draft.startDate}
        onChange={(startDate) => change({ startDate })}
        min={addDays(today(), -365 * 5)}
        max={addDays(today(), 365)}
      />
      <Sheet visible={pickingCategory} onClose={() => setPickingCategory(false)} title="Category">
        {catalog.categories.map((c, index) => (
          <SheetRow
            key={c.id}
            first={index === 0}
            icon={() => <Emoji char={c.emoji} size={24} />}
            label={c.label}
            trailing={c.id === category?.id ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : undefined}
            onPress={() => {
              change({ category: c.id });
              setPickingCategory(false);
            }}
          />
        ))}
      </Sheet>
    </Screen>
  );
}
