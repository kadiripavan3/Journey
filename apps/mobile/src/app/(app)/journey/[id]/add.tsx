import { useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarDays, ChevronRight, LocateFixed, MapPin, Star, WifiOff, X } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MediaStrip } from '@/features/composer/MediaStrip';
import { useComposer } from '@/features/composer/useComposer';
import { useLeave } from '@/features/navigation/useLeave';
import { hasPoint } from '@/features/places/place';
import { PlaceSheet } from '@/features/places/PlaceSheet';
import { PageProblem } from '@/features/states/PageProblem';
import { formatDayLong, today } from '@/lib/dates';
import { layout, radius, textStyle, useTheme } from '@/theme';
import { AvoidKeyboard } from '@/ui/AvoidKeyboard';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { ConfirmSheet } from '@/ui/ConfirmSheet';
import { DayPicker } from '@/ui/DayPicker';
import { EmptyState } from '@/ui/EmptyState';
import { Loading } from '@/ui/Loading';
import { Tap } from '@/ui/Motion';
import { NoteBox } from '@/ui/NoteBox';
import { Photo } from '@/ui/Photo';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet } from '@/ui/Sheet';
import { Toggle } from '@/ui/Toggle';
import { MAX_TEXT_SCALE, Txt } from '@/ui/Txt';
import { webNoOutline } from '@/ui/web';

/**
 * 7.2 New entry: photos and short clips in one strip, gentle prompts, the day and the place. Also used to
 * edit an entry, and to carry on with a draft.
 *
 * A new entry is handed to Drafts and uploads the moment Post is tapped: the composer closes at once and the
 * entry goes up in the background, or waits there when there is no connection. Changing an entry that is
 * already posted is saved directly. However the screen is left (the X, Android's back button), anything
 * unsaved gets a question first. The rules are in `useComposer`.
 */
export default function Composer() {
  const { id, entry: entryId, draft: draftId, was } = useLocalSearchParams<{ id: string; entry?: string; draft?: string; was?: string }>();
  const router = useRouter();
  const leave = useLeave();
  const { colors } = useTheme();
  const c = useComposer({ journeyId: id, entryId, draftId, was });
  const [placing, setPlacing] = useState(false);
  const j = c.journey;

  if (c.error) {
    return (
      <Gate onClose={leave}>
        <PageProblem inset={false} error={c.error} onRetry={c.retry} retrying={c.retrying} />
      </Gate>
    );
  }
  if (!j || !c.ready) {
    return (
      <Gate onClose={leave}>
        <Loading offline={c.offline} />
      </Gate>
    );
  }
  // Entries are dated from the journey's first day on, and never in the future. Until that day comes there is
  // no day an entry could have, so say when it starts and offer the way to change that.
  if (c.startsLater) {
    return (
      <Gate onClose={leave}>
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 60 }}>
          <EmptyState
            emoji="🧳"
            title={`It starts on ${formatDayLong(j.startDate)}`}
            body={c.isOwner ? 'You can add entries from that day on. Already on your way? Move the start date.' : 'You can add entries from that day on.'}
            action={c.isOwner ? <Button label="Change the start date" variant="line" onPress={() => router.replace(`/journey/${id}/edit`)} /> : undefined}
          />
        </View>
      </Gate>
    );
  }

  const editing = c.mode === 'edit';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <AvoidKeyboard style={{ flex: 1 }}>
        <View style={{ minHeight: 58, paddingHorizontal: layout.barGutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <RoundButton label="Close" onPress={c.close} icon={(color) => <X size={20} color={color} />} />
          <Txt variant="subheading" accessibilityRole="header">
            {editing ? 'Edit entry' : c.mode === 'draft' ? 'Draft' : 'New entry'}
          </Txt>
          <Button label={editing ? 'Save' : 'Post'} inline size="sm" disabled={!c.hasContent} loading={c.busy} onPress={editing ? c.save : c.post} />
        </View>

        <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginHorizontal: layout.barGutter, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: radius.cardLarge, backgroundColor: colors.fill }}>
            <Photo uri={j.coverThumbUrl} radius="thumb" style={{ width: 28, height: 28, backgroundColor: colors.fill2 }} />
            <Txt variant="caption" weight={500} numberOfLines={1} color="muted" style={{ maxWidth: 270 }}>
              {editing ? 'In ' : 'Posting to '}
              <Txt variant="caption" weight={700}>
                {j.title}
              </Txt>
            </Txt>
          </View>

          <MediaStrip
            shots={c.shots}
            names={c.names}
            heldIds={c.heldIds}
            onRemove={c.removeShot}
            onAdd={c.canAddMedia ? () => void c.addMedia() : undefined}
            clips={c.clips}
            photoCount={c.photoCount}
            clipCount={c.clipCount}
            leftOut={c.leftOut}
            locked={c.picking || c.busy}
          />

          <View style={{ marginHorizontal: layout.barGutter, gap: 6 }}>
            <TextInput
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              accessibilityLabel="Title, optional"
              value={c.title}
              onChangeText={c.setTitle}
              placeholder="Title"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              maxLength={80}
              style={[webNoOutline, textStyle('title', 800, { oneLine: true }), { padding: 0, color: colors.text }]}
            />
            <TextInput
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              accessibilityLabel="What happened"
              value={c.body}
              onChangeText={c.setBody}
              placeholder="What happened?"
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              multiline
              maxLength={2000}
              style={[webNoOutline, textStyle('bodyLarge'), { padding: 0, minHeight: 96, color: colors.text, textAlignVertical: 'top' }]}
            />
          </View>

          {c.prompts.length > 0 && c.body.length === 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: layout.barGutter }} keyboardShouldPersistTaps="handled">
              {c.prompts.map((prompt) => (
                <Tap
                  key={prompt}
                  accessibilityRole="button"
                  accessibilityLabel={`Start with: ${prompt}`}
                  hitSlop={{ top: 5, bottom: 5 }}
                  scaleTo={0.94}
                  onPress={() => c.setBody(`${prompt} `)}
                  style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: radius.photo, backgroundColor: colors.accentSoft }}>
                  <Txt variant="caption" weight={700} style={{ color: colors.accentText }}>
                    {prompt}
                  </Txt>
                </Tap>
              ))}
            </ScrollView>
          ) : null}

          <Card style={{ marginHorizontal: layout.barGutter, borderRadius: radius.card }}>
            <Row icon={<CalendarDays size={20} color={colors.text} />}>
              <DayRow label={c.dayLabel} journeyStart={j.startDate} day={c.day} onChange={c.chooseDay} />
            </Row>
            <Row icon={<MapPin size={20} color={colors.accentText} />} divider>
              <Tap accessibilityRole="button" accessibilityLabel={c.place ? `Place: ${c.place.name}. Change the place` : 'Add a place'} scaleTo={0.985} onPress={() => setPlacing(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}>
                <Txt variant="item" weight={600} numberOfLines={1} color={c.place ? 'text' : 'muted'} style={{ flex: 1 }}>
                  {c.place ? c.place.name : 'Add a place'}
                </Txt>
                <ChevronRight size={18} color={colors.muted} />
              </Tap>
            </Row>
            {!c.place && c.suggested ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={`Use ${c.suggested.name}, where the first photo was taken`}
                hitSlop={{ top: 8, bottom: 8 }}
                scaleTo={0.985}
                onPress={() => c.suggested && c.setPlace({ name: c.suggested.name, lat: c.suggested.lat, lng: c.suggested.lng, exact: false })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, marginLeft: 48, marginRight: 16, marginBottom: 12 }}>
                <Txt variant="footnote" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                  From your photo: {c.suggested.name}
                </Txt>
                <Txt variant="footnote" weight={800} style={{ color: colors.accentText }}>
                  Use
                </Txt>
              </Tap>
            ) : null}
            {hasPoint(c.place) ? (
              <Row icon={<LocateFixed size={20} color={colors.text} />} divider>
                <View style={{ flex: 1 }}>
                  <Txt variant="item" weight={600}>
                    Show the exact spot
                  </Txt>
                  <Txt variant="footnote" color="muted">
                    {c.place.exact ? 'People see the exact point on the map.' : 'People see the area, not the exact point.'}
                  </Txt>
                </View>
                <Toggle label="Show the exact spot" value={c.place.exact} onChange={(exact) => c.place && c.setPlace({ ...c.place, exact })} />
              </Row>
            ) : null}
            <Row icon={<Star size={20} color={colors.text} />} divider>
              <Txt variant="item" weight={600} style={{ flex: 1 }}>
                Mark as milestone
              </Txt>
              <Toggle label="Mark as milestone" value={c.milestone} onChange={c.setMilestone} />
            </Row>
          </Card>

          {!editing && !c.online ? (
            <NoteBox tone="warn" icon={(color) => <WifiOff size={18} color={color} />} style={{ marginHorizontal: layout.barGutter }}>
              You&apos;re offline. Post it anyway: it&apos;s saved on this phone and goes up when you&apos;re back.
            </NoteBox>
          ) : null}

          {c.problem || c.progress ? (
            <Txt variant="caption" color={c.problem ? 'danger' : 'muted'} center accessibilityLiveRegion="polite" style={{ marginHorizontal: 24 }}>
              {c.problem ?? c.progress}
            </Txt>
          ) : null}
        </ScrollView>
      </AvoidKeyboard>

      <PlaceSheet visible={placing} onClose={() => setPlacing(false)} value={c.place} onChange={c.setPlace} photoPoint={c.photoPoint} />
      {editing ? (
        <ConfirmSheet visible={c.asking} onClose={c.keepWriting} title="Discard your changes?" body="The entry stays as it was." confirm="Discard changes" cancel="Keep editing" onConfirm={c.discard} />
      ) : (
        <Sheet visible={c.asking} onClose={c.keepWriting} title={c.mode === 'draft' ? 'Keep this draft?' : 'Save this for later?'} subtitle="A draft stays on this phone until you post it. You'll find it under Drafts and uploads, on your profile.">
          <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
            <Button label={c.mode === 'draft' ? 'Save draft' : 'Save as a draft'} size="lg" block loading={c.busy} onPress={c.saveDraft} />
            <Button label={c.mode === 'draft' ? 'Delete draft' : 'Discard'} variant="danger" size="lg" block onPress={c.discard} />
            <Button label="Keep writing" variant="soft" size="lg" block onPress={c.keepWriting} />
          </View>
        </Sheet>
      )}
    </SafeAreaView>
  );
}

/** The composer before there is anything to write in: a way out at the top, and what is going on below it. */
function Gate({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: layout.barGutter, paddingTop: 8 }}>
        <RoundButton label="Close" onPress={onClose} icon={(color) => <X size={20} color={color} />} />
      </View>
      {children}
    </SafeAreaView>
  );
}

function Row({ icon, children, divider }: { icon: ReactNode; children: ReactNode; divider?: boolean }) {
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
      <Tap accessibilityRole="button" accessibilityLabel={`${label}. Change the day`} scaleTo={0.985} onPress={() => setOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}>
        <Txt variant="item" weight={600} style={{ flex: 1 }}>
          {label}
        </Txt>
        <ChevronRight size={18} color={colors.muted} />
      </Tap>
      <DayPicker visible={open} onClose={() => setOpen(false)} title="When did this happen?" value={day} onChange={onChange} min={journeyStart} max={today()} />
    </>
  );
}
