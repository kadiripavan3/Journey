/** Entries that aren't posted yet: drafts, and what is on its way up or waiting for a connection. */
import { plural } from './plural';

export const drafts = {
  // What a draft is called and what it holds
  untitled: 'Untitled entry',
  /** "2 photos · 1 clip", or "Text only". */
  contents: (photos: number, clips: number) => [photos > 0 ? plural(photos, 'photo') : null, clips > 0 ? plural(clips, 'clip') : null].filter(Boolean).join(' · ') || 'Text only',
  /** "Text only · saved 2h ago". `contents` and `ago` are already written out. */
  saved: (contents: string, ago: string) => `${contents} · saved ${ago}`,

  // What is going up right now, or what it waits for
  progress: {
    waitingTurn: 'Waiting for its turn',
    waitingConnection: 'Waiting for a connection',
    posting: 'Posting',
    /** A clip is made smaller on the phone before it goes up. */
    preparing: (at: number, of: number) => (of > 1 ? `Getting clip ${at} of ${of} ready` : 'Getting the clip ready'),
    /** "4 of 6 photos", "Clip 2 of 3", or "Uploading the photo" when there is one. */
    uploading: (isPhoto: boolean, at: number, of: number) => (of > 1 ? (isPhoto ? `${at} of ${of} photos` : `Clip ${at} of ${of}`) : isPhoto ? 'Uploading the photo' : 'Uploading the clip'),
    /** The same with what comes after: "4 of 6 photos · then 1 clip". */
    then: (now: string, next: number, nextAreClips: boolean) => `${now} · then ${plural(next, nextAreClips ? 'clip' : 'photo')}`,
  },
  stuck: "This entry keeps failing to upload although you're online. Open it to try again; a very long clip may be too much for this connection.",
  cantPost: "It couldn't be posted.",

  // On a journey's story: its entries that are on their way, in one line. `others` is how many more there are.
  banner: {
    failed: (title: string) => `Couldn't post "${title}"`,
    saved: (title: string, others: number) => `Saved: "${title}"${others > 0 ? ` and ${others} more` : ''}`,
    posting: (title: string, others: number) => `Posting "${title}"${others > 0 ? ` and ${others} more` : ''}`,
    tryAgain: 'Open it to try again.',
    whenOnline: "It posts by itself when you're back online.",
    spoken: (headline: string, detail: string) => `${headline}. ${detail} Open drafts and uploads.`,
  },

  // On your own profile: the way to Drafts and uploads
  link: {
    title: 'Drafts and uploads',
    onTheWay: (count: number) => `${count} on ${count === 1 ? 'its' : 'their'} way`,
    failed: (count: number) => `${count} couldn't upload`,
    drafts: (count: number) => plural(count, 'draft'),
    /** `parts` are the ones above that apply. */
    spoken: (parts: readonly string[]) => `Drafts and uploads. ${parts.join(', ')}`,
  },

  // Drafts and uploads
  page: {
    title: 'Drafts and uploads',
    none: {
      title: 'Nothing waiting',
      body: 'Drafts you save, and entries you write without a signal, wait here until they are posted.',
    },
    offline: {
      title: "You're offline",
      body: "Everything here is saved on this phone. Entries post by themselves when you're back.",
    },
    onTheirWay: {
      title: 'On their way',
      body: 'Entries go up while Journey is open. If you close it, they carry on from where they stopped next time.',
    },
    uploading: 'Uploading',
    waiting: 'Waiting to upload',
    failed: "Couldn't upload",
    drafts: 'Drafts',
    retry: 'Retry',
    /** What a screen reader says for each row. */
    failedSpoken: (title: string, problem: string) => `${title}. ${problem} Open to change it.`,
    draftSpoken: (title: string, saved: string) => `${title}. ${saved}. Open the draft.`,
    remove: (title: string) => `Delete ${title}`,
    confirmDelete: {
      title: 'Delete this draft?',
      body: 'It only exists on this phone, so it will be gone for good.',
      confirm: 'Delete draft',
    },
  },
} as const;
