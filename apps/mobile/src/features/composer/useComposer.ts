import { usePreventRemove, useRouter } from 'expo-router';
import { useRef, useState } from 'react';

import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { changeEntry, useGetEntry, useGetJourney } from '@/api/generated/journey';
import { uploadPhoto } from '@/api/upload';
import { useOutbox } from '@/features/drafts/outbox';
import type { Draft, DraftInput, DraftJourney, DraftMedia } from '@/features/drafts/types';
import { useCatalog } from '@/features/journeys/catalog';
import { entryDay, type Point } from '@/features/media/exif';
import { MAX_CLIPS, MAX_PHOTOS, pickMedia } from '@/features/media/pick';
import { sendClip } from '@/features/media/sendClip';
import { useLeave } from '@/features/navigation/useLeave';
import { placeAt } from '@/features/places/lookup';
import { type FoundPlace, type PickedPlace, placeFields, placeOf } from '@/features/places/place';
import { daysBetween, formatDay, formatDayLong, momentFor, today } from '@/lib/dates';
import { newClientId } from '@/lib/ids';
import { loadState } from '@/lib/loading';
import { words } from '@/words';

/** A photo or clip in the composer: already uploaded (it has a media id) or still on the phone. */
export type Shot = DraftMedia;

type Written = { title: string; body: string; place: PickedPlace | null; milestone: boolean; day: string; shots: Shot[] };

/** Everything that was written, as one line of text: two of these differ exactly when something was changed. */
const picture = (w: Written) => JSON.stringify([w.title.trim(), w.body.trim(), w.place, w.milestone, w.day, w.shots.map((shot) => shot.key)]);

type Args = {
  journeyId: string;
  /** Set when an entry that is already posted is being changed. */
  entryId?: string;
  /** Set when carrying on with a draft from Drafts and uploads. */
  draftId?: string;
  /** What that draft was before it was taken out of the line to be opened here ("queued" or "failed"). */
  was?: string;
};

/**
 * The composer's data and rules (7.2 New entry): what is written, where it starts from (nothing, a posted
 * entry or a draft), what Post, Save and Close do, and the question before anything written is thrown away.
 * The screen only lays it out.
 */
export function useComposer({ journeyId, entryId, draftId, was }: Args) {
  const router = useRouter();
  const leave = useLeave();
  const catalog = useCatalog();
  const cache = useCache();
  const outbox = useOutbox();
  // One id for this draft: tapping Post twice, or sending again after a lost answer, still makes one entry.
  const [clientId] = useState(() => draftId ?? newClientId());
  const journey = useGetJourney(journeyId);
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
  const [leftOut, setLeftOut] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  /** What was here when the composer opened a posted entry or a draft. Null for a new entry. */
  const [start, setStart] = useState<string | null>(null);
  const [filled, setFilled] = useState(false);
  /** The question before leaving is showing. */
  const [asking, setAsking] = useState(false);
  /** The person has chosen (posted, saved, discarded): the screen may go without another question. */
  const [leaving, setLeaving] = useState(false);
  /** Carries on with the Back or swipe that the question interrupted. */
  const goOn = useRef<(() => void) | null>(null);

  const fill = (from: Written) => {
    setFilled(true);
    setTitle(from.title);
    setBody(from.body);
    setPlace(from.place);
    setMilestone(from.milestone);
    setDay(from.day);
    setDayChosen(true);
    setShots(from.shots);
    setStart(picture(from));
  };
  // When editing, start from the entry as it is.
  if (entryId && editing.data && !filled) {
    const e = editing.data;
    fill({
      title: e.title,
      body: e.body,
      place: placeOf(e),
      milestone: e.isMilestone,
      day: e.happenedOn,
      // The strip shows the small version; the entry keeps the file it has.
      shots: e.media.map((m) => ({ key: m.id, kind: m.kind, uri: m.thumbUrl ?? m.url, width: m.width ?? 0, height: m.height ?? 0, durationSeconds: m.durationSeconds ?? undefined, mediaId: m.id })),
    });
  }
  // When carrying on with a draft, start from where it was left. A draft from an earlier day keeps its day;
  // one written for a day that is still to come can't.
  if (stored && !filled) {
    fill({ title: stored.title, body: stored.body, place: stored.place, milestone: stored.milestone, day: stored.day > today() ? today() : stored.day, shots: stored.media });
  }

  // What the composer needs of the journey. A draft carries its own copy, so it opens without a connection.
  const j: DraftJourney | undefined = journey.data
    ? { title: journey.data.title, startDate: journey.data.startDate, labelStyle: journey.data.labelStyle, template: journey.data.template, coverThumbUrl: journey.data.coverThumbUrl }
    : stored?.journey;
  const needs = entryId ? loadState(journey, editing) : loadState(journey);
  const ready = !!j && (!entryId || filled);

  const photoCount = shots.filter((shot) => shot.kind === 'photo').length;
  const clipCount = shots.length - photoCount;
  // Clips are offered only where the API can take them.
  const clipRoom = catalog.clips ? MAX_CLIPS - clipCount : 0;
  const hasContent = shots.length > 0 || title.trim().length > 0 || body.trim().length > 0;
  const busy = progress !== null;
  const changed = start !== null && picture({ title, body, place, milestone, day, shots }) !== start;
  // A new entry is worth a question once something is written; a draft or a posted entry once it was changed.
  const unsaved = ready && (start === null ? hasContent : changed);
  /** The draft was waiting to go up (or had failed) and was only taken out of the line to be opened here. */
  const held: Draft['state'] | null = stored && (was === 'queued' || was === 'failed') ? was : null;

  /** Opened and closed without a change: a draft that was in line goes back in line. */
  const putBack = () => {
    if (held) outbox.release(clientId, held);
  };
  // Android's back button and a swipe leave the screen without passing the X. While there is something to
  // lose (or to put back in line), the navigator asks here first.
  const stopGuard = usePreventRemove(!leaving && (unsaved || !!held), ({ repeat }) => {
    if (unsaved) {
      goOn.current = repeat;
      setAsking(true);
    } else {
      putBack();
      setLeaving(true);
      repeat();
    }
  });
  /** Leaves for good: the question is over, so nothing holds the screen back. */
  const finish = (to?: () => void) => {
    setAsking(false);
    setLeaving(true);
    const carryOn = goOn.current;
    goOn.current = null;
    if (to) {
      stopGuard();
      to();
    } else if (carryOn) {
      carryOn();
    } else {
      stopGuard();
      leave();
    }
  };

  /** The X. Closing with something unsaved asks what to do with it; nothing is thrown away by a slip of the thumb. */
  const close = () => {
    goOn.current = null;
    if (unsaved) {
      setAsking(true);
    } else {
      putBack();
      finish();
    }
  };

  const addMedia = async () => {
    if (!j) return;
    setPicking(true);
    setProblem(null);
    try {
      const { picked, leftOut: note } = await pickMedia({ photos: MAX_PHOTOS - photoCount, clips: clipRoom });
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
      setProblem(words.media.photosClosed);
    } finally {
      setPicking(false);
    }
  };

  const dayNumber = j ? daysBetween(j.startDate, day) + 1 : 1;

  /** A new entry: handed over to go up in the background (or to wait for a connection), and the composer closes. */
  const hand = async (how: 'post' | 'draft') => {
    if (!j) return;
    setProblem(null);
    setProgress(how === 'post' ? words.drafts.progress.posting : words.composer.progress.saving);
    try {
      const draft: DraftInput = { clientId, journeyId, journey: j, title, body, day, dayLabel: j.labelStyle === 'day' ? words.composer.dayNumber(dayNumber) : formatDay(day), place, milestone, media: shots };
      await outbox.save(draft, how);
      finish(how === 'post' ? () => router.dismissTo(`/journey/${journeyId}/timeline`) : undefined);
    } catch {
      setAsking(false);
      setProblem(words.composer.cantSave);
    } finally {
      setProgress(null);
    }
  };

  /** An entry that is already posted: its new photos and clips go up, then the change is saved. */
  const save = async () => {
    if (!entryId) return;
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
        const label = waiting > 1 ? words.composer.progress.uploading(sent, waiting) : words.composer.progress.uploadingOne(shot.kind === 'video');
        setProgress(label);
        const mediaId = shot.kind === 'video' ? await sendClip(shot, (part) => setProgress(words.composer.progress.withPercent(label, Math.round(part * 100)))) : await uploadPhoto(shot);
        // Remember the upload, so trying again after a failure doesn't send the same file twice.
        setShots((now) => now.map((s) => (s.key === shot.key ? { ...s, mediaId } : s)));
        mediaIds.push(mediaId);
      }
      setProgress(words.composer.progress.saving);
      await changeEntry(entryId, {
        title: title.trim(),
        body: body.trim(),
        ...placeFields(place),
        isMilestone: milestone,
        happenedOn: day,
        // Editing keeps the entry's own moment unless the day changed.
        happenedAt: editing.data?.happenedOn === day ? editing.data.happenedAt : momentFor(day),
        mediaIds,
      });
      await cache.entrySaved(journeyId, entryId);
      finish();
    } catch (error) {
      setProblem(messageFor(error));
    } finally {
      setProgress(null);
    }
  };

  // "Photo 2", "Clip 1": each counted among its own kind, in the order they are shown.
  const names = shots.map((shot, index) => words.composer.media.name(shot.kind === 'video', shots.slice(0, index).filter((other) => other.kind === shot.kind).length + 1));

  return {
    /** What kind of composer this is. */
    mode: entryId ? ('edit' as const) : stored ? ('draft' as const) : ('new' as const),
    journey: j,
    /** Whether the person opening it owns the journey (and so may move its start date). */
    isOwner: journey.data?.viewer.isOwner ?? false,
    ready,
    /** Set when what the composer needs couldn't be loaded and there is nothing to show. */
    error: stored ? null : needs.error,
    retry: needs.retry,
    retrying: needs.retrying,
    offline: needs.offline,
    /** The journey starts on a later day, so there is no day a new entry could have yet. */
    startsLater: !entryId && !!j && j.startDate > today(),

    title,
    setTitle,
    body,
    setBody,
    place,
    setPlace,
    milestone,
    setMilestone,
    day,
    chooseDay: (next: string) => {
      setDay(next);
      setDayChosen(true);
    },
    dayLabel: j ? (j.labelStyle === 'day' ? words.common.join([words.composer.dayNumber(dayNumber), formatDayLong(day)]) : formatDayLong(day)) : '',
    shots,
    names,
    /** The ids of photos a reviewer still has to look at: shown veiled, as everywhere else. */
    heldIds: new Set((editing.data?.media ?? []).filter((m) => m.held).map((m) => m.id)),
    removeShot: (key: string) => setShots((now) => now.filter((shot) => shot.key !== key)),
    photoCount,
    clipCount,
    canAddMedia: photoCount < MAX_PHOTOS || clipRoom > 0,
    clips: catalog.clips,
    addMedia,
    picking,
    leftOut,
    photoPoint,
    suggested,
    prompts: catalog.template(j?.template ?? '')?.prompts ?? [],

    hasContent,
    busy,
    progress,
    problem,
    online: outbox.online,

    post: () => void hand('post'),
    save: () => void save(),
    close,
    asking,
    saveDraft: () => void hand('draft'),
    /** Throws away what was written here. A draft goes for good; a posted entry stays as it was. */
    discard: () => {
      if (stored) void outbox.discard(clientId);
      finish();
    },
    keepWriting: () => {
      goOn.current = null;
      setAsking(false);
    },
  };
}
