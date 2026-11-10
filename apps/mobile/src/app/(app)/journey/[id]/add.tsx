import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import { CalendarDays, ChevronRight, ImagePlus, LocateFixed, MapPin, Star, WifiOff, X } from 'lucide-react-native';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { messageFor } from '@/api/fetcher';
import { changeEntry, useGetEntry, useGetJourney } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { uploadPhoto } from '@/api/upload';
import { useOutbox } from '@/features/drafts/outbox';
import type { DraftInput, DraftJourney, DraftMedia } from '@/features/drafts/types';
import { useCatalog } from '@/features/journeys/catalog';
import { ClipBadge } from '@/features/media/ClipPlayer';
import { entryDay, type Point } from '@/features/media/exif';
import { MAX_CLIPS, MAX_PHOTOS, pickMedia } from '@/features/media/pick';
import { sendClip } from '@/features/media/sendClip';
import { placeAt } from '@/features/places/lookup';
import { type FoundPlace, hasPoint, type PickedPlace, placeFields, placeOf } from '@/features/places/place';
import { PlaceSheet } from '@/features/places/PlaceSheet';
import { newClientId } from '@/lib/ids';
import { daysBetween, formatDay, formatDayLong, momentFor, today } from '@/lib/dates';
import { layout, radius, textStyle, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { DayPicker } from '@/ui/DayPicker';
import { EmptyState } from '@/ui/EmptyState';
import { Loading } from '@/ui/Loading';
import { Photo } from '@/ui/Photo';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet } from '@/ui/Sheet';
import { Toggle } from '@/ui/Toggle';
import { Txt } from '@/ui/Txt';
import { webNoOutline } from '@/ui/web';

/** A photo or clip in the composer: already uploaded (it has a media id) or still on the phone. */
type Shot = DraftMedia;

/**
 * 7.2 New entry: photos and short clips in one strip, gentle prompts, the day and the place. Also used to
 * edit an entry, and to carry on with a draft.
 *
 * A new entry is handed to Drafts and uploads the moment Post is tapped: the composer closes at once and the
 * entry goes up in the background, or waits there when there is no connection. Changing an entry that is
 * already posted is saved directly.
 */
export default function Composer() {
  const { id, entry: entryId, draft: draftId } = useLocalSearchParams<{ id: string; entry?: string; draft?: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const cache = useCache();
  const outbox = useOutbox();
  // One id for this draft: tapping Post twice, or sending again after a lost answer, still makes one entry.
  const [clientId] = useState(() => draftId ?? newClientId());
  const journey = useGetJourney(id);
  const editing = useGetEntry(entryId ?? '', { query: { enabled: !!entryId } });
  const stored = draftId ? outbox.drafts.find((draft) => draft.clientId === draftId) : undefined;

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [place, setPlace] = useState<PickedPlace | null>(null);
  const [milestone, setMilestone] = useState(false);
  const [day, setDay] = useState(today());
  // Once the person picks a day, a photo's own date no longer moves it.
  const [dayChosen, setDayChosen] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  /** Where the first photo was taken, and the place that is, when they could be worked out. */
  const [photoPoint, setPhotoPoint] = useState<Point | undefined>(undefined);
  const [suggested, setSuggested] = useState<FoundPlace | null>(null);
  const [picking, setPicking] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [closing, setClosing] = useState(false);
  const [leftOut, setLeftOut] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);

  // When editing, start from the entry as it is.
  if (entryId && editing.data && !filled) {
    const e = editing.data;
    setFilled(true);
    setTitle(e.title);
    setBody(e.body);
    setPlace(placeOf(e));
    setMilestone(e.isMilestone);
    setDay(e.happenedOn);
    setDayChosen(true);
    setShots(e.media.map((m) => ({ key: m.id, kind: m.kind, uri: m.url, width: m.width ?? 0, height: m.height ?? 0, durationSeconds: m.durationSeconds ?? undefined, mediaId: m.id })));
  }
  // When carrying on with a draft, start from where it was left.
  if (stored && !filled) {
    setFilled(true);
    setTitle(stored.title);
    setBody(stored.body);
    setPlace(stored.place);
    setMilestone(stored.milestone);
    // A draft from an earlier day keeps its day; one written for a day that is still to come can't.
    setDay(stored.day > today() ? today() : stored.day);
    setDayChosen(true);
    setShots(stored.media);
  }

  // What the composer needs of the journey. A draft carries its own copy, so it opens without a connection.
  const j: DraftJourney | undefined = journey.data ? { title: journey.data.title, startDate: journey.data.startDate, labelStyle: journey.data.labelStyle, template: journey.data.template, coverThumbUrl: journey.data.coverThumbUrl } : stored?.journey;

  const failed = (!j && journey.isError) || (!!entryId && editing.isError);
  if (failed) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: layout.barGutter, paddingTop: 8 }}>
          <RoundButton label="Close" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
        </View>
        <Problem message={messageFor(journey.error ?? editing.error)} onRetry={() => void journey.refetch()} />
      </SafeAreaView>
    );
  }
  if (!j || (entryId && !filled)) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loading />
      </SafeAreaView>
    );
  }

  // Entries are dated from the journey's first day on, and never in the future. Until that day comes there is
  // no day an entry could have, so say when it starts and offer the way to change that.
  if (!entryId && j.startDate > today()) {
    const owner = journey.data?.viewer.isOwner ?? false;
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: layout.barGutter, paddingTop: 8 }}>
          <RoundButton label="Close" onPress={() => router.back()} icon={(c) => <X size={20} color={c} />} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 60 }}>
          <EmptyState
            emoji="🧳"
            title={`It starts on ${formatDayLong(j.startDate)}`}
            body={owner ? 'You can add entries from that day on. Already on your way? Move the start date.' : 'You can add entries from that day on.'}
            action={owner ? <Button label="Change the start date" variant="line" onPress={() => router.replace(`/journey/${id}/edit`)} /> : undefined}
          />
        </View>
      </SafeAreaView>
    );
  }

  const prompts = catalog.template(j.template)?.prompts ?? [];
  const dayNumber = daysBetween(j.startDate, day) + 1;
  const dayLabel = j.labelStyle === 'day' ? `Day ${dayNumber} · ${formatDayLong(day)}` : formatDayLong(day);
  const photoCount = shots.filter((shot) => shot.kind === 'photo').length;
  const clipCount = shots.length - photoCount;
  const hasContent = shots.length > 0 || title.trim().length > 0 || body.trim().length > 0;
  const busy = progress !== null;

  const addMedia = async () => {
    setPicking(true);
    setProblem(null);
    try {
      const { picked, leftOut: note } = await pickMedia({ photos: MAX_PHOTOS - photoCount, clips: MAX_CLIPS - clipCount });
      setLeftOut(note);
      if (picked.length === 0) return;
      const firstPhoto = photoCount === 0 ? picked.find((item) => item.kind === 'photo') : undefined;
      // The first photo knows when and where it was taken: a new entry starts on that day, and its place is offered.
      if (firstPhoto && !entryId && !dayChosen) setDay(entryDay(firstPhoto.takenOn, j.startDate, today()));
      if (firstPhoto?.point) {
        const point = firstPhoto.point;
        setPhotoPoint(point);
        void placeAt(point.lat, point.lng).then(setSuggested);
      }
      setShots((now) => [...now, ...picked.map((item, i) => ({ key: `${Date.now()}-${i}`, kind: item.kind, uri: item.uri, width: item.width, height: item.height, durationSeconds: item.durationSeconds, mimeType: item.mimeType }))]);
    } catch {
      setProblem("We couldn't open your photos. Check that Journey may see them in the phone's Settings.");
    } finally {
      setPicking(false);
    }
  };

  /** Everything written here, as Drafts and uploads keeps it. */
  const draft = (): DraftInput => ({
    clientId,
    journeyId: id,
    journey: j,
    title,
    body,
    day,
    dayLabel: j.labelStyle === 'day' ? `Day ${dayNumber}` : formatDay(day),
    place,
    milestone,
    media: shots,
  });

  /** A new entry: handed over to go up in the background (or to wait for a connection), and the composer closes. */
  const post = async (how: 'post' | 'draft') => {
    setProblem(null);
    setProgress(how === 'post' ? 'Posting' : 'Saving');
    try {
      await outbox.save(draft(), how);
      setClosing(false);
      if (how === 'post') router.dismissTo(`/journey/${id}/timeline`);
      else router.back();
    } catch {
      setClosing(false);
      setProblem("This entry couldn't be saved on your phone. Free up some space and try again.");
    } finally {
      setProgress(null);
    }
  };

  /** An entry that is already posted: its new photos and clips go up, then the change is saved. */
  const save = async (existing: string) => {
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
        const what = shot.kind === 'video' ? 'clip' : 'photo';
        const label = waiting > 1 ? `Uploading ${sent} of ${waiting}` : `Uploading the ${what}`;
        setProgress(label);
        const mediaId = shot.kind === 'video' ? await sendClip(shot, (part) => setProgress(`${label} · ${Math.round(part * 100)}%`)) : await uploadPhoto(shot);
        // Remember the upload, so trying again after a failure doesn't send the same file twice.
        setShots((now) => now.map((s) => (s.key === shot.key ? { ...s, mediaId } : s)));
        mediaIds.push(mediaId);
      }
      setProgress('Saving');
      await changeEntry(existing, {
        title: title.trim(),
        body: body.trim(),
        ...placeFields(place),
        isMilestone: milestone,
        happenedOn: day,
        // Editing keeps the entry's own moment unless the day changed.
        happenedAt: editing.data?.happenedOn === day ? editing.data.happenedAt : momentFor(day),
        mediaIds,
      });
      await cache.entrySaved(id, existing);
      router.back();
    } catch (error) {
      setProblem(messageFor(error));
    } finally {
      setProgress(null);
    }
  };

  /** Closing with something written asks what to do with it; nothing is thrown away by a slip of the thumb. */
  const close = () => {
    if (entryId || (!hasContent && !stored)) router.back();
    else setClosing(true);
  };
  const discard = () => {
    setClosing(false);
    if (stored) void outbox.discard(clientId);
    router.back();
  };

  // "Photo 2", "Clip 1": each counted among its own kind, in the order they are shown.
  const names = shots.map((shot, index) => `${shot.kind === 'video' ? 'Clip' : 'Photo'} ${shots.slice(0, index).filter((other) => other.kind === shot.kind).length + 1}`);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={{ height: 58, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <RoundButton label="Close" onPress={close} icon={(c) => <X size={20} color={c} />} />
          <Txt variant="subheading" accessibilityRole="header">
            {entryId ? 'Edit entry' : stored ? 'Draft' : 'New entry'}
          </Txt>
          <Button label={entryId ? 'Save' : 'Post'} inline size="sm" disabled={!hasContent} loading={busy} onPress={() => void (entryId ? save(entryId) : post('post'))} />
        </View>

        <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginHorizontal: 16, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: radius.cardLarge, backgroundColor: colors.fill }}>
            <Photo uri={j.coverThumbUrl} radius="thumb" style={{ width: 28, height: 28, backgroundColor: colors.fill2 }} />
            <Txt variant="caption" weight={500} numberOfLines={1} color="muted" style={{ maxWidth: 270 }}>
              {entryId ? 'In ' : 'Posting to '}
              <Txt variant="caption" weight={700}>
                {j.title}
              </Txt>
            </Txt>
          </View>

          <View style={{ gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingHorizontal: layout.barGutter }} keyboardShouldPersistTaps="handled">
              {shots.map((shot, index) => {
                const clip = shot.kind === 'video';
                const name = names[index] ?? 'Photo';
                return (
                  <View key={shot.key} style={{ width: 104, height: 140, borderRadius: radius.photo, overflow: 'hidden', backgroundColor: colors.fill }}>
                    {clip && !shot.mediaId ? <ClipFrame uri={shot.uri} /> : <Image source={{ uri: shot.uri }} style={{ flex: 1 }} contentFit="cover" accessibilityLabel={name} />}
                    {clip ? <ClipBadge seconds={shot.durationSeconds} style={{ position: 'absolute', left: 7, bottom: 7 }} /> : null}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${name.toLowerCase()}`}
                      hitSlop={8}
                      disabled={busy}
                      onPress={() => setShots((now) => now.filter((s) => s.key !== shot.key))}
                      style={{ position: 'absolute', top: 7, right: 7, width: 24, height: 24, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.photoGlass }}>
                      <X size={13} color={colors.onPhoto} strokeWidth={2.6} />
                    </Pressable>
                  </View>
                );
              })}
              {photoCount < MAX_PHOTOS || clipCount < MAX_CLIPS ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={shots.length === 0 ? 'Add photos or clips' : 'Add more photos or clips'}
                  disabled={picking || busy}
                  onPress={() => void addMedia()}
                  style={({ pressed }) => ({
                    width: 104,
                    height: 140,
                    borderRadius: radius.photo,
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    borderWidth: 1.5,
                    borderColor: colors.fill2,
                    opacity: pressed || picking ? 0.6 : 1,
                  })}>
                  <ImagePlus size={22} color={colors.muted} />
                  <Txt variant="footnote" color="muted" weight={700} center style={{ marginHorizontal: 8 }}>
                    {shots.length === 0 ? 'Photos or clips' : 'Add'}
                  </Txt>
                </Pressable>
              ) : null}
            </ScrollView>
            {shots.length > 0 || leftOut ? (
              <Txt variant="footnote" color="muted" accessibilityLiveRegion="polite" style={{ marginHorizontal: layout.barGutter }}>
                {shots.length > 0 ? `${photoCount} of ${MAX_PHOTOS} photos · ${clipCount} of ${MAX_CLIPS} clips` : ''}
                {leftOut ? `${shots.length > 0 ? '. ' : ''}${leftOut}` : ''}
              </Txt>
            ) : null}
          </View>

          <View style={{ marginHorizontal: layout.barGutter, gap: 6 }}>
            <TextInput
              accessibilityLabel="Title, optional"
              value={title}
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              maxLength={80}
              style={[webNoOutline, textStyle('title', 800, { oneLine: true }), { padding: 0, color: colors.text }]}
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
              style={[webNoOutline, textStyle('bodyLarge'), { padding: 0, minHeight: 96, color: colors.text, textAlignVertical: 'top' }]}
            />
          </View>

          {prompts.length > 0 && body.length === 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter }} keyboardShouldPersistTaps="handled">
              {prompts.map((prompt) => (
                <Pressable
                  key={prompt}
                  accessibilityRole="button"
                  accessibilityLabel={`Start with: ${prompt}`}
                  onPress={() => setBody(`${prompt} `)}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.photo, backgroundColor: colors.accentSoft }}>
                  <Txt variant="caption" weight={700} style={{ color: colors.accentText }}>
                    {prompt}
                  </Txt>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          <Card style={{ marginHorizontal: 16, borderRadius: radius.card }}>
            <Row icon={<CalendarDays size={20} color={colors.text} />}>
              <DayRow
                label={dayLabel}
                journeyStart={j.startDate}
                day={day}
                onChange={(next) => {
                  setDay(next);
                  setDayChosen(true);
                }}
              />
            </Row>
            <Row icon={<MapPin size={20} color={colors.accentText} />} divider>
              <Pressable accessibilityRole="button" accessibilityLabel={place ? `Place: ${place.name}. Change the place` : 'Add a place'} onPress={() => setPlacing(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Txt variant="item" weight={600} numberOfLines={1} color={place ? 'text' : 'muted'} style={{ flex: 1 }}>
                  {place ? place.name : 'Add a place'}
                </Txt>
                <ChevronRight size={18} color={colors.muted} />
              </Pressable>
            </Row>
            {!place && suggested ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use ${suggested.name}, where the first photo was taken`}
                onPress={() => setPlace({ name: suggested.name, lat: suggested.lat, lng: suggested.lng, exact: false })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 48, marginRight: 16, marginBottom: 12 }}>
                <Txt variant="footnote" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                  From your photo: {suggested.name}
                </Txt>
                <Txt variant="footnote" weight={800} style={{ color: colors.accentText }}>
                  Use
                </Txt>
              </Pressable>
            ) : null}
            {hasPoint(place) ? (
              <Row icon={<LocateFixed size={20} color={colors.text} />} divider>
                <View style={{ flex: 1 }}>
                  <Txt variant="item" weight={600}>
                    Show the exact spot
                  </Txt>
                  <Txt variant="footnote" color="muted">
                    {place.exact ? 'People see the exact point on the map.' : 'People see the area, not the exact point.'}
                  </Txt>
                </View>
                <Toggle label="Show the exact spot" value={place.exact} onChange={(exact) => setPlace({ ...place, exact })} />
              </Row>
            ) : null}
            <Row icon={<Star size={20} color={colors.text} />} divider>
              <Txt variant="item" weight={600} style={{ flex: 1 }}>
                Mark as milestone
              </Txt>
              <Toggle label="Mark as milestone" value={milestone} onChange={setMilestone} />
            </Row>
          </Card>

          {!entryId && !outbox.online ? (
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginHorizontal: layout.barGutter, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.photo, backgroundColor: colors.fill }}>
              <WifiOff size={18} color={colors.warn} style={{ marginTop: 1 }} />
              <Txt variant="note" style={{ flex: 1 }}>
                You&apos;re offline. Post it anyway: it&apos;s saved on this phone and goes up when you&apos;re back.
              </Txt>
            </View>
          ) : null}

          {problem || progress ? (
            <Txt variant="caption" color={problem ? 'danger' : 'muted'} center accessibilityLiveRegion="polite" style={{ marginHorizontal: 24 }}>
              {problem ?? progress}
            </Txt>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <PlaceSheet visible={placing} onClose={() => setPlacing(false)} value={place} onChange={setPlace} photoPoint={photoPoint} />
      <Sheet visible={closing} onClose={() => setClosing(false)} title={stored ? 'Keep this draft?' : 'Save this for later?'} subtitle="A draft stays on this phone until you post it. You'll find it under Drafts and uploads, on your profile.">
        <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button label={stored ? 'Save draft' : 'Save as a draft'} size="lg" block loading={busy} onPress={() => void post('draft')} />
          <Button label={stored ? 'Delete draft' : 'Discard'} variant="danger" size="lg" block onPress={discard} />
          <Button label="Keep writing" variant="soft" size="lg" block onPress={() => setClosing(false)} />
        </View>
      </Sheet>
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

/** A clip that is still on the phone, shown by its first frame. It doesn't play here. */
function ClipFrame({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (created) => {
    created.muted = true;
  });
  return <VideoView player={player} style={{ flex: 1 }} contentFit="cover" nativeControls={false} accessible={false} />;
}

/** The day the entry belongs to. It can be any day from the journey's start until today. */
function DayRow({ label, journeyStart, day, onChange }: { label: string; journeyStart: string; day: string; onChange: (day: string) => void }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${label}. Change the day`} onPress={() => setOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Txt variant="item" weight={600} style={{ flex: 1 }}>
          {label}
        </Txt>
        <ChevronRight size={18} color={colors.muted} />
      </Pressable>
      <DayPicker visible={open} onClose={() => setOpen(false)} title="When did this happen?" value={day} onChange={onChange} min={journeyStart} max={today()} />
    </>
  );
}
