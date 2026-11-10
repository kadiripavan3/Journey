import type { PickedPlace } from '@/features/places/place';

/** A photo or clip in a draft. Until it is uploaded it is a file on the phone; after that it has a media id. */
export type DraftMedia = {
  key: string;
  kind: 'photo' | 'video';
  /** Where to show it from. For a kept file this is worked out again each time the app starts. */
  uri: string;
  /** The file's name inside the draft's own folder, once the draft has been saved on the phone. */
  file?: string;
  width: number;
  height: number;
  durationSeconds?: number;
  mimeType?: string;
  /** Set once it has been uploaded, so a second try doesn't send it again. */
  mediaId?: string;
};

/**
 * Where a draft is: `draft` waits for its author; `queued` waits for its turn or for a connection;
 * `sending` is going up now; `failed` was refused and needs a look.
 */
export type DraftState = 'draft' | 'queued' | 'sending' | 'failed';

/** What the composer needs to know about the journey, kept with the draft so it opens without a connection. */
export type DraftJourney = { title: string; startDate: string; labelStyle: 'day' | 'part'; template: string; coverThumbUrl: string | null };

/** An entry that hasn't been posted yet, kept on the phone. */
export type Draft = {
  /** Made up when the entry was started, and sent with it: posting the same draft twice makes one entry. */
  clientId: string;
  /** Whose draft it is. Another person signing in on the same phone doesn't see it. */
  owner: string;
  journeyId: string;
  journey: DraftJourney;
  title: string;
  body: string;
  /** "2026-04-01" */
  day: string;
  /** "Day 7", worked out when it was saved. */
  dayLabel: string;
  place: PickedPlace | null;
  milestone: boolean;
  media: DraftMedia[];
  state: DraftState;
  /** Why it failed, in a sentence for the person. */
  problem?: string;
  /**
   * When it was written: the first time it was kept on the phone. The entry is posted with this moment, so
   * one that waited a day for a connection still sits where it was written. (Drafts from before this was
   * kept have none; they use when they were last saved.)
   */
  writtenAt?: string;
  /** When it was last saved. */
  savedAt: string;
};

/** What the composer hands over to be kept: everything but who owns it, where it is and when it was written. */
export type DraftInput = Omit<Draft, 'owner' | 'state' | 'problem' | 'writtenAt' | 'savedAt'>;

/** How far a draft that is going up has come. */
export type Progress = {
  /** What is going up now: a photo, a clip, or (last) the entry itself. */
  kind: 'photo' | 'video' | 'entry';
  /** Among the files of that kind that had to be sent: which one this is, counting from 1, and how many there are. */
  at: number;
  of: number;
  /** How many files of the other kind come after it. */
  then: number;
  /** The whole draft, from 0 to 1. */
  fraction: number;
  /** True while a clip is still being made smaller on the phone, before it goes up. */
  preparing?: boolean;
};

/** Where drafts are kept. The phone uses SQLite and its own folder; a browser, and the tests, something simpler. */
export type DraftStore = {
  /** This person's drafts, oldest first. */
  load(owner: string): Promise<Draft[]>;
  save(draft: Draft): Promise<void>;
  /** Forgets a draft and the files kept for it. */
  remove(clientId: string): Promise<void>;
  /** Forgets every draft of this person and their files: the account is gone. */
  removeAll(owner: string): Promise<void>;
  /** Copies a picked file to where it stays until the draft is sent: what the picker hands out doesn't last. */
  keep(clientId: string, media: DraftMedia): Promise<DraftMedia>;
};
