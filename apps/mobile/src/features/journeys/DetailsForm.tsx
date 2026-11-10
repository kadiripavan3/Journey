import { Image } from 'expo-image';
import { CalendarDays, Camera, Check } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { View } from 'react-native';

import type { LocalPhoto } from '@/api/upload';
import { pickPhotos } from '@/features/media/pick';
import { addDays, formatDayLong, today } from '@/lib/dates';
import { radius, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { DayPicker } from '@/ui/DayPicker';
import { Emoji } from '@/ui/Emoji';
import { Field, FieldButton } from '@/ui/Field';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

import { useCatalog } from './catalog';
import { parseTags } from './draft';

/** What a journey's details are, as the form holds them. Tags are the text as typed. */
export type JourneyDetails = { title: string; description: string; tags: string; startDate: string; category: string | null | undefined };

type Props = {
  value: JourneyDetails;
  onChange: (patch: Partial<JourneyDetails>) => void;
  /** The cover to show: a photo just picked, or the one the journey has. */
  coverUri?: string | null;
  onCover: (photo: LocalPhoto) => void;
  /** Something that went wrong outside the form (saving), shown where the form's own problems are. */
  problem?: string | null;
  titlePlaceholder?: string;
  /** The question above the calendar: "When does it start?" */
  dayTitle: string;
  /** More fields after the form's own, such as who can see the journey. */
  children?: ReactNode;
};

/**
 * A journey's details: cover, title, start date, category, what it's about and tags. The one form for
 * starting a journey (7.5) and for changing it later.
 */
export function DetailsForm({ value, onChange, coverUri, onCover, problem, titlePlaceholder, dayTitle, children }: Props) {
  const { colors } = useTheme();
  const catalog = useCatalog();
  const [picking, setPicking] = useState<'day' | 'category' | null>(null);
  const [photoProblem, setPhotoProblem] = useState<string | null>(null);
  const category = catalog.category(value.category);
  const tags = parseTags(value.tags);
  const shown = photoProblem ?? problem;

  const chooseCover = async () => {
    setPhotoProblem(null);
    try {
      const [photo] = await pickPhotos(1);
      if (photo) onCover(photo);
    } catch {
      setPhotoProblem(words.media.photosClosed);
    }
  };

  return (
    <>
      <View style={{ height: 168, marginBottom: 16, borderRadius: radius.cardLarge, overflow: 'hidden', backgroundColor: colors.fill, alignItems: 'center', justifyContent: 'center' }}>
        {coverUri ? <Image source={{ uri: coverUri }} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} contentFit="cover" accessibilityLabel="The journey's cover" /> : null}
        {coverUri ? (
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
      {shown ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ marginBottom: 12 }}>
          {shown}
        </Txt>
      ) : null}

      <View style={{ gap: 12 }}>
        <Field label="Title" value={value.title} onChangeText={(title) => onChange({ title })} maxLength={80} autoCapitalize="sentences" returnKeyType="next" placeholder={titlePlaceholder} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <FieldButton label="Starts" value={formatDayLong(value.startDate)} icon={<CalendarDays size={18} color={colors.text} />} onPress={() => setPicking('day')} />
          <FieldButton label="Category" value={category ? category.label : 'Choose'} icon={category ? <Emoji char={category.emoji} size={20} /> : undefined} onPress={() => setPicking('category')} />
        </View>
        <Field label="What's it about? · optional" value={value.description} onChangeText={(description) => onChange({ description })} multiline maxLength={300} />
        <Field
          label="Tags · up to 5"
          value={value.tags}
          onChangeText={(text) => onChange({ tags: text })}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="iceland roadtrip vanlife"
          note={tags.length > 0 ? tags.map((tag) => `#${tag}`).join('  ') : 'Separate tags with spaces.'}
        />
        {children}
      </View>

      <DayPicker visible={picking === 'day'} onClose={() => setPicking(null)} title={dayTitle} value={value.startDate} onChange={(startDate) => onChange({ startDate })} min={addDays(today(), -365 * 5)} max={addDays(today(), 365)} />
      <Sheet visible={picking === 'category'} onClose={() => setPicking(null)} title="Category">
        {catalog.categories.map((c, index) => (
          <SheetRow
            key={c.id}
            first={index === 0}
            icon={() => <Emoji char={c.emoji} size={24} />}
            label={c.label}
            trailing={c.id === category?.id ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : undefined}
            onPress={() => {
              onChange({ category: c.id });
              setPicking(null);
            }}
          />
        ))}
      </Sheet>
    </>
  );
}
