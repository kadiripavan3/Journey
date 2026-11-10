import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, ImagePlus, MapPin, Star, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, type TextStyle, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { addEntry, changeEntry, type SaveEntryRequest, useGetEntry, useGetJourney } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { uploadPhoto } from '@/api/upload';
import { useCatalog } from '@/journey/catalog';
import { pickPhotos } from '@/journey/pick';
import { daysBetween, formatDayLong, momentFor, today } from '@/lib/dates';
import { fontFor, useTheme } from '@/theme';
import { Card, Loading, Photo, Problem, Toggle } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { DayPicker } from '@/ui/DayPicker';
import { RoundButton } from '@/ui/RoundButton';
import { Txt } from '@/ui/Txt';

const MAX_PHOTOS = 10;
const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** A photo in the composer: either already uploaded (it has a media id) or still on the phone. */
type Shot = { key: string; uri: string; width: number; height: number; mediaId?: string };

/** 7.2 New entry: photos in one strip, gentle prompts, the day and the place. Also used to edit an entry. */
export default function Composer() {
  const { id, entry: entryId } = useLocalSearchParams<{ id: string; entry?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const refresh = useRefreshAll();
  const journey = useGetJourney(id);
  const editing = useGetEntry(entryId ?? '', { query: { enabled: !!entryId } });

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [place, setPlace] = useState('');
  const [milestone, setMilestone] = useState(false);
  const [day, setDay] = useState(today());
  const [shots, setShots] = useState<Shot[]>([]);
  const [picking, setPicking] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  // When editing, start from the entry as it is.
  if (entryId && editing.data && !filled) {
    const e = editing.data;
    setFilled(true);
    setTitle(e.title);
    setBody(e.body);
    setPlace(e.placeName ?? '');
    setMilestone(e.isMilestone);
    setDay(e.happenedOn);
    setShots(e.media.map((m) => ({ key: m.id, uri: m.url, width: m.width ?? 0, height: m.height ?? 0, mediaId: m.id })));
  }

  if (journey.isError || (entryId && editing.isError)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <RoundButton label="Close" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
        </View>
        <Problem error={journey.error ?? editing.error} onRetry={() => void journey.refetch()} />
      </SafeAreaView>
    );
  }
  if (journey.isPending || (entryId && !filled)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading />
      </SafeAreaView>
    );
  }

  const j = journey.data;
  const prompts = catalog.template(j.template)?.prompts ?? [];
  const dayLabel = j.labelStyle === 'day' ? `Day ${daysBetween(j.startDate, day) + 1} · ${formatDayLong(day)}` : formatDayLong(day);
  const hasContent = shots.length > 0 || title.trim().length > 0 || body.trim().length > 0;
  const busy = progress !== null;

  const addPhotos = async () => {
    setPicking(true);
    try {
      const picked = await pickPhotos(MAX_PHOTOS - shots.length);
      setShots((now) => [...now, ...picked.map((p, i) => ({ ...p, key: `${Date.now()}-${i}` }))].slice(0, MAX_PHOTOS));
    } catch {
      setProblem("We couldn't open your photos. Check that Journey may see them in the phone's Settings.");
    } finally {
      setPicking(false);
    }
  };

  const post = async () => {
    setProblem(null);
    try {
      const mediaIds: string[] = [];
      const waiting = shots.filter((shot) => !shot.mediaId).length;
      let sent = 0;
      for (const shot of shots) {
        if (shot.mediaId) {
          mediaIds.push(shot.mediaId);
          continue;
        }
        sent += 1;
        setProgress(waiting > 1 ? `Uploading photo ${sent} of ${waiting}` : 'Uploading photo');
        const mediaId = await uploadPhoto(shot);
        // Remember the upload, so trying again after a failure doesn't send the same photo twice.
        setShots((now) => now.map((s) => (s.key === shot.key ? { ...s, mediaId } : s)));
        mediaIds.push(mediaId);
      }
      setProgress(entryId ? 'Saving' : 'Posting');
      const data: SaveEntryRequest = {
        title: title.trim(),
        body: body.trim(),
        placeName: place.trim(),
        isMilestone: milestone,
        happenedOn: day,
        // Editing keeps the entry's own moment unless the day changed.
        happenedAt: entryId && editing.data?.happenedOn === day ? editing.data.happenedAt : momentFor(day),
        mediaIds,
      };
      if (entryId) await changeEntry(entryId, data);
      else await addEntry(id, data);
      await refresh();
      if (entryId) router.back();
      else router.dismissTo(`/journey/${id}/timeline` as never);
    } catch (error) {
      setProblem(messageFor(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <RoundButton label="Close" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
          <Txt accessibilityRole="header" weight={800} style={{ fontSize: 17, lineHeight: 22, letterSpacing: -0.3 }}>
            {entryId ? 'Edit entry' : 'New entry'}
          </Txt>
          <Button label={entryId ? 'Save' : 'Post'} inline size="sm" disabled={!hasContent} loading={busy} onPress={() => void post()} />
        </View>

        <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginHorizontal: 16, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: 22, backgroundColor: colors.fill }}>
            <Photo uri={j.coverUrl} radius={14} style={{ width: 28, height: 28, backgroundColor: colors.fill2 }} />
            <Txt numberOfLines={1} color="muted" style={{ fontSize: 13, lineHeight: 18, maxWidth: 270 }}>
              {entryId ? 'In ' : 'Posting to '}
              <Txt weight={700} style={{ fontSize: 13, lineHeight: 18 }}>
                {j.title}
              </Txt>
            </Txt>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
            {shots.map((shot, index) => (
              <View key={shot.key} style={{ width: 104, height: 140, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.fill }}>
                <Image source={{ uri: shot.uri }} style={{ flex: 1 }} contentFit="cover" accessibilityLabel={`Photo ${index + 1}`} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${index + 1}`}
                  hitSlop={8}
                  disabled={busy}
                  onPress={() => setShots((now) => now.filter((s) => s.key !== shot.key))}
                  style={{ position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.photoGlass }}>
                  <X size={13} color={colors.onPhoto} strokeWidth={2.6} />
                </Pressable>
              </View>
            ))}
            {shots.length < MAX_PHOTOS ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={shots.length === 0 ? 'Add photos' : 'Add more photos'}
                disabled={picking || busy}
                onPress={() => void addPhotos()}
                style={({ pressed }) => ({
                  width: 104,
                  height: 140,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: 1.5,
                  borderColor: colors.fill2,
                  opacity: pressed || picking ? 0.6 : 1,
                })}>
                <ImagePlus size={22} color={colors.muted} />
                <Txt color="muted" weight={700} style={{ fontSize: 12.5, lineHeight: 17 }}>
                  {shots.length === 0 ? 'Add photos' : 'Add'}
                </Txt>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={{ marginHorizontal: 16, gap: 6 }}>
            <TextInput
              accessibilityLabel="Title, optional"
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              maxLength={80}
              style={[webNoOutline, { padding: 0, fontFamily: fontFor[800], fontSize: 22, letterSpacing: -0.5, color: colors.text }]}
            />
            <TextInput
              accessibilityLabel="What happened"
              value={body}
              onChangeText={setBody}
              placeholder="What happened?"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              multiline
              maxLength={2000}
              style={[webNoOutline, { padding: 0, minHeight: 96, fontFamily: fontFor[500], fontSize: 17, lineHeight: 25, color: colors.text, textAlignVertical: 'top' }]}
            />
          </View>

          {prompts.length > 0 && body.length === 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
              {prompts.map((prompt) => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  accessibilityLabel={`Start with: ${prompt}`}
                  onPress={() => setBody(`${prompt} `)}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, backgroundColor: colors.accentSoft }}>
                  <Txt weight={700} style={{ fontSize: 13, lineHeight: 18, color: colors.accentText }}>
                    {prompt}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Card style={{ marginHorizontal: 16, borderRadius: 20 }}>
            <Row icon={<CalendarDays size={20} color={colors.text} />}>
              <DayRow label={dayLabel} journeyStart={j.startDate} day={day} onChange={setDay} />
            </Row>
            <Row icon={<MapPin size={20} color={colors.accentText} />} divider>
              <TextInput
                accessibilityLabel="Place, optional"
                value={place}
                onChangeText={setPlace}
                placeholder="Add a place"
                placeholderTextColor={colors.muted}
                selectionColor={colors.accent}
                maxLength={80}
                style={[webNoOutline, { flex: 1, padding: 0, fontFamily: fontFor[600], fontSize: 15, color: colors.text }]}
              />
            </Row>
            <Row icon={<Star size={20} color={colors.text} />} divider>
              <Txt weight={600} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
                Mark as milestone
              </Txt>
              <Toggle label="Mark as milestone" value={milestone} onChange={setMilestone} />
            </Row>
          </Card>

          {problem || progress ? (
            <Txt variant="caption" color={problem ? 'danger' : 'muted'} center accessibilityLiveRegion="polite" style={{ marginHorizontal: 24 }}>
              {problem ?? progress}
            </Txt>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Row({ icon, children, divider }: { icon: React.ReactNode; children: React.ReactNode; divider?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10, paddingHorizontal: 16, borderTopWidth: divider ? 1 : 0, borderTopColor: colors.line }}>
      {icon}
      {children}
    </View>
  );
}

/** The day the entry belongs to. It can be any day from the journey's start until today. */
function DayRow({ label, journeyStart, day, onChange }: { label: string; journeyStart: string; day: string; onChange: (day: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Change the day`} onPress={() => setOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Txt weight={600} style={{ flex: 1, fontSize: 15, lineHeight: 20 }}>
          {label}
        </Txt>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
      <DayPicker visible={open} onClose={() => setOpen(false)} title="When did this happen?" value={day} onChange={onChange} min={journeyStart} max={today()} />
    </>
  );
}
