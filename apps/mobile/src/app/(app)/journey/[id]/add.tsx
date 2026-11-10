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
import { rich } from '@/ui/rich';
import { words } from '@/words';

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
            title={words.composer.startsLater.title(formatDayLong(j.startDate))}
            body={c.isOwner ? words.composer.startsLater.owner : words.composer.startsLater.member}
            action={c.isOwner ? <Button label={words.composer.startsLater.changeStart} variant="line" onPress={() => router.replace(`/journey/${id}/edit`)} /> : undefined}
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
          <RoundButton label={words.common.close} onPress={c.close} icon={(color) => <X size={20} color={color} />} />
          <Txt variant="subheading" accessibilityRole="header">
            {editing ? words.composer.heading.edit : c.mode === 'draft' ? words.composer.heading.draft : words.composer.heading.fresh}
          </Txt>
          <Button label={editing ? words.common.save : words.composer.post} inline size="sm" disabled={!c.hasContent} loading={c.busy} onPress={editing ? c.save : c.post} />
        </View>

        <ScrollView contentContainerStyle={{ gap: 16, paddingTop: 8, paddingBottom: 40 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, marginHorizontal: layout.barGutter, paddingVertical: 6, paddingLeft: 6, paddingRight: 12, borderRadius: radius.cardLarge, backgroundColor: colors.fill }}>
            <Photo uri={j.coverThumbUrl} radius="thumb" style={{ width: 28, height: 28, backgroundColor: colors.fill2 }} />
            <Txt variant="caption" weight={500} numberOfLines={1} color="muted" style={{ maxWidth: 270 }}>
              {rich(editing ? words.composer.inJourney(j.title) : words.composer.postingTo(j.title), {
                bold: (text) => (
                  <Txt variant="caption" weight={700}>
                    {text}
                  </Txt>
                ),
              })}
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
              accessibilityLabel={words.composer.title.spoken}
              value={c.title}
              onChangeText={c.setTitle}
              placeholder={words.composer.title.hint}
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              maxLength={80}
              style={[webNoOutline, textStyle('title', 800, { oneLine: true }), { padding: 0, color: colors.text }]}
            />
            <TextInput
              maxFontSizeMultiplier={MAX_TEXT_SCALE}
              accessibilityLabel={words.composer.body.spoken}
              value={c.body}
              onChangeText={c.setBody}
              placeholder={words.composer.body.hint}
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
                  accessibilityLabel={words.composer.startWith(prompt)}
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
              <Tap accessibilityRole="button" accessibilityLabel={c.place ? words.composer.place.spoken(c.place.name) : words.composer.place.add} scaleTo={0.985} onPress={() => setPlacing(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}>
                <Txt variant="item" weight={600} numberOfLines={1} color={c.place ? 'text' : 'muted'} style={{ flex: 1 }}>
                  {c.place ? c.place.name : words.composer.place.add}
                </Txt>
                <ChevronRight size={18} color={colors.muted} />
              </Tap>
            </Row>
            {!c.place && c.suggested ? (
              <Tap
                accessibilityRole="button"
                accessibilityLabel={words.composer.place.useSpoken(c.suggested.name)}
                hitSlop={{ top: 8, bottom: 8 }}
                scaleTo={0.985}
                onPress={() => c.suggested && c.setPlace({ name: c.suggested.name, lat: c.suggested.lat, lng: c.suggested.lng, exact: false })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28, marginLeft: 48, marginRight: 16, marginBottom: 12 }}>
                <Txt variant="footnote" color="muted" numberOfLines={1} style={{ flex: 1 }}>
                  {words.composer.place.fromPhoto(c.suggested.name)}
                </Txt>
                <Txt variant="footnote" weight={800} style={{ color: colors.accentText }}>
                  {words.composer.place.use}
                </Txt>
              </Tap>
            ) : null}
            {hasPoint(c.place) ? (
              <Row icon={<LocateFixed size={20} color={colors.text} />} divider>
                <View style={{ flex: 1 }}>
                  <Txt variant="item" weight={600}>
                    {words.composer.place.exact}
                  </Txt>
                  <Txt variant="footnote" color="muted">
                    {c.place.exact ? words.composer.place.exactOn : words.composer.place.exactOff}
                  </Txt>
                </View>
                <Toggle label={words.composer.place.exact} value={c.place.exact} onChange={(exact) => c.place && c.setPlace({ ...c.place, exact })} />
              </Row>
            ) : null}
            <Row icon={<Star size={20} color={colors.text} />} divider>
              <Txt variant="item" weight={600} style={{ flex: 1 }}>
                {words.composer.milestone}
              </Txt>
              <Toggle label={words.composer.milestone} value={c.milestone} onChange={c.setMilestone} />
            </Row>
          </Card>

          {!editing && !c.online ? (
            <NoteBox tone="warn" icon={(color) => <WifiOff size={18} color={color} />} style={{ marginHorizontal: layout.barGutter }}>
              {words.composer.offline}
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
        <ConfirmSheet visible={c.asking} onClose={c.keepWriting} title={words.composer.discardChanges.title} body={words.composer.discardChanges.body} confirm={words.composer.discardChanges.confirm} cancel={words.composer.discardChanges.cancel} onConfirm={c.discard} />
      ) : (
        <Sheet visible={c.asking} onClose={c.keepWriting} title={c.mode === 'draft' ? words.composer.leave.titleDraft : words.composer.leave.title} subtitle={words.composer.leave.body}>
          <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
            <Button label={c.mode === 'draft' ? words.composer.leave.saveDraft : words.composer.leave.saveAsDraft} size="lg" block loading={c.busy} onPress={c.saveDraft} />
            <Button label={c.mode === 'draft' ? words.composer.leave.deleteDraft : words.composer.leave.discard} variant="danger" size="lg" block onPress={c.discard} />
            <Button label={words.composer.leave.keepWriting} variant="soft" size="lg" block onPress={c.keepWriting} />
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
        <RoundButton label={words.common.close} onPress={onClose} icon={(color) => <X size={20} color={color} />} />
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
      <Tap accessibilityRole="button" accessibilityLabel={words.composer.day.spoken(label)} scaleTo={0.985} onPress={() => setOpen(true)} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 32 }}>
        <Txt variant="item" weight={600} style={{ flex: 1 }}>
          {label}
        </Txt>
        <ChevronRight size={18} color={colors.muted} />
      </Tap>
      <DayPicker visible={open} onClose={() => setOpen(false)} title={words.composer.day.title} value={day} onChange={onChange} min={journeyStart} max={today()} />
    </>
  );
}
