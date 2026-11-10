import { lastAnswerAt, messageFor } from '@/api/fetcher';

import { howItFailed, sendDraft, uploadsForgotten } from './send';
import type { Draft, DraftInput, DraftStore, Progress } from './types';

/** After nothing answered: how long the whole line rests before the next try. Longer each time, up to two minutes. */
const restFor = (fails: number) => Math.min(15_000 * 2 ** Math.max(fails - 1, 0), 120_000);
/** After a failed try: how long that one entry waits before its next. Longer each time, up to five minutes. */
const waitFor = (tries: number) => Math.min(10_000 * 2 ** Math.max(tries - 1, 0), 300_000);
/** "Not now" this many times in a row, and an entry stops trying by itself: it needs a look. */
export const MOST_TRIES = 6;
/** Nothing answered this many times for one entry while the API did answer others: it is the entry, not the connection. */
export const STUCK_AFTER = 4;
/** While something goes up, screens hear about its progress at most this often. */
const PROGRESS_EVERY_MS = 250;

const STUCK = "This entry keeps failing to upload although you're online. Open it to try again; a very long clip may be too much for this connection.";

type Waiting = { tries: number; since: number; notBefore: number };
type Timer = ReturnType<typeof setTimeout>;

type Options = {
  store: DraftStore;
  /** Whose drafts these are. */
  owner: string;
  /** An entry is up: the journey's story and numbers have changed. */
  onPosted: (journeyId: string) => void;
};

/**
 * The line of entries that haven't been posted yet, for one person, and the work of posting them: one at a
 * time, oldest first, its photos and clips and then the entry. It knows nothing about screens; `OutboxProvider`
 * shows what it holds.
 *
 * What happens when a try fails depends on how it failed (`howItFailed`):
 *  - nothing answered: that is the connection. The entry keeps its place and the whole line rests a while.
 *  - "not now" (the API stumbled, is busy or is being updated): that entry waits, longer each time, and is
 *    tried again; after `MOST_TRIES` it becomes "couldn't upload" with the API's sentence.
 *  - a plain no: "couldn't upload" at once, with the API's sentence.
 * An entry that has failed lets the ones that haven't go first, so one stuck entry never holds up the rest.
 * And one that gets no answer again and again while the API answers everything else is stuck itself: it
 * becomes "couldn't upload" too, instead of being tried for ever.
 */
export class OutboxEngine {
  private all: Draft[] = [];
  private shown: Draft[] = [];
  private readonly heard = new Set<() => void>();
  private readonly progress = new Map<string, Progress>();
  private readonly heardProgress = new Set<() => void>();
  private progressTimer: Timer | null = null;
  private sending: string | null = null;
  private online = true;
  private running = false;
  private fails = 0;
  private restUntil = 0;
  private readonly waiting = new Map<string, Waiting>();
  private readonly resent = new Set<string>();
  private wake: Timer | null = null;

  constructor(private readonly options: Options) {}

  /** Brings back what was waiting from the last time the app was open, and starts sending. */
  start(): void {
    this.running = true;
    this.options.store
      .load(this.options.owner)
      .then((drafts) => {
        // Anything saved while the list was loading stays.
        this.all = [...drafts.filter((draft) => !this.find(draft.clientId)), ...this.all];
        this.changed();
      })
      .catch(() => undefined);
  }

  /** Stops starting new work. What is going up right now finishes and is remembered. */
  stop(): void {
    this.running = false;
    if (this.wake) clearTimeout(this.wake);
    if (this.progressTimer) clearTimeout(this.progressTimer);
    this.wake = null;
    this.progressTimer = null;
  }

  /** The phone says whether it has a connection. Back online, everything that was waiting is tried at once. */
  setOnline(online: boolean): void {
    if (online === this.online) return;
    this.online = online;
    if (online) {
      this.fails = 0;
      this.restUntil = 0;
      for (const wait of this.waiting.values()) wait.notBefore = 0;
    }
    this.pump();
  }

  /** For screens: hears when the list of drafts changes. */
  readonly subscribe = (listener: () => void): (() => void) => {
    this.heard.add(listener);
    return () => {
      this.heard.delete(listener);
    };
  };

  /** This person's drafts and entries on their way, oldest first. The same list until something changes. */
  readonly getDrafts = (): Draft[] => this.shown;

  /** For screens: hears when the progress of what is going up changes, a few times a second at most. */
  readonly subscribeProgress = (listener: () => void): (() => void) => {
    this.heardProgress.add(listener);
    return () => {
      this.heardProgress.delete(listener);
    };
  };

  /** How far a draft that is going up has come; undefined when it isn't going up. */
  readonly getProgress = (clientId: string): Progress | undefined => this.progress.get(clientId);

  /** Keeps what the composer holds on the phone. "post" puts it in line to go up; "draft" leaves it waiting for its author. */
  async save(input: DraftInput, how: 'draft' | 'post'): Promise<void> {
    const { store, owner } = this.options;
    const media = [];
    for (const item of input.media) media.push(await store.keep(input.clientId, item));
    const now = new Date().toISOString();
    const draft: Draft = { ...input, media, owner, state: how === 'post' ? 'queued' : 'draft', problem: undefined, writtenAt: this.find(input.clientId)?.writtenAt ?? now, savedAt: now };
    await store.save(draft);
    this.waiting.delete(draft.clientId);
    this.put(draft);
  }

  /** Takes a draft out of the line, so it can be changed. False when it is going up right now. */
  hold(clientId: string): boolean {
    if (this.sending === clientId) return false;
    const draft = this.find(clientId);
    if (draft && draft.state !== 'draft') this.keep({ ...draft, state: 'draft', problem: undefined });
    return true;
  }

  /** Puts back in line a draft that was only held to be looked at. `was` is what `hold` took it out of. */
  release(clientId: string, was: Draft['state']): void {
    const draft = this.find(clientId);
    if (!draft || draft.state !== 'draft' || was === 'draft' || was === 'sending') return;
    this.keep({ ...draft, state: 'queued', problem: undefined });
  }

  /** Puts a failed one back in line, to be tried now. */
  retry(clientId: string): void {
    const draft = this.find(clientId);
    if (!draft || this.sending === clientId) return;
    this.fails = 0;
    this.restUntil = 0;
    this.waiting.delete(clientId);
    this.keep({ ...draft, state: 'queued', problem: undefined });
  }

  /** Forgets a draft and its files. Does nothing while it is going up. */
  async discard(clientId: string): Promise<void> {
    if (this.sending === clientId) return;
    await this.forget([clientId]);
  }

  /** The journey was deleted: what was waiting to be posted to it goes with it. */
  async discardJourney(journeyId: string): Promise<void> {
    await this.forget(this.all.filter((draft) => draft.journeyId === journeyId).map((draft) => draft.clientId));
  }

  /** The account was deleted: nothing of it stays on the phone. */
  async discardEverything(): Promise<void> {
    this.all = [];
    this.waiting.clear();
    this.changed();
    await this.options.store.removeAll(this.options.owner).catch(() => undefined);
  }

  private find(clientId: string): Draft | undefined {
    return this.all.find((draft) => draft.clientId === clientId);
  }

  private async forget(clientIds: string[]): Promise<void> {
    if (clientIds.length === 0) return;
    this.all = this.all.filter((draft) => !clientIds.includes(draft.clientId));
    for (const clientId of clientIds) this.waiting.delete(clientId);
    this.changed();
    for (const clientId of clientIds) await this.options.store.remove(clientId).catch(() => undefined);
  }

  /** Shows a draft's new state and writes it to the phone. */
  private keep(next: Draft): void {
    this.put(next);
    void this.options.store.save(next).catch(() => undefined);
  }

  private put(next: Draft): void {
    this.all = [...this.all.filter((draft) => draft.clientId !== next.clientId), next];
    this.changed();
  }

  private changed(): void {
    this.shown = [...this.all].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    this.heard.forEach((listener) => listener());
    this.pump();
  }

  private setProgress(clientId: string, step: Progress | undefined): void {
    const before = this.progress.get(clientId);
    if (step) this.progress.set(clientId, step);
    else this.progress.delete(clientId);
    // The start, the end and each new file are told at once; in between, a few times a second is plenty.
    const sameFile = !!before && !!step && before.kind === step.kind && before.at === step.at && before.preparing === step.preparing;
    const tell = () => {
      if (this.progressTimer) clearTimeout(this.progressTimer);
      this.progressTimer = null;
      this.heardProgress.forEach((listener) => listener());
    };
    if (!sameFile) tell();
    else this.progressTimer ??= setTimeout(tell, PROGRESS_EVERY_MS);
  }

  /** If the phone is online and nothing is going up, the next entry that is due goes; otherwise this waits for it. */
  private pump(): void {
    if (this.wake) clearTimeout(this.wake);
    this.wake = null;
    if (!this.running || !this.online || this.sending) return;
    const queued = this.shown.filter((draft) => draft.state === 'queued');
    if (queued.length === 0) return;
    const now = Date.now();
    const tries = (draft: Draft) => this.waiting.get(draft.clientId)?.tries ?? 0;
    const dueAt = (draft: Draft) => Math.max(this.restUntil, this.waiting.get(draft.clientId)?.notBefore ?? 0);
    // Oldest first; but one that has failed lets those that haven't go before it.
    const next = queued.filter((draft) => dueAt(draft) <= now).sort((a, b) => tries(a) - tries(b))[0];
    if (next) {
      void this.run(next);
      return;
    }
    this.wake = setTimeout(() => this.pump(), Math.max(Math.min(...queued.map(dueAt)) - now, 0));
  }

  private async run(draft: Draft): Promise<void> {
    const { store, onPosted } = this.options;
    const id = draft.clientId;
    this.sending = id;
    let current: Draft = { ...draft, state: 'sending', problem: undefined };
    let failure: unknown = null;
    let posted = false;
    try {
      // Kept as "queued" until it is done: if the app closes now, it carries on from here next time.
      await store.save({ ...current, state: 'queued' });
      this.put(current);
      await sendDraft(current, {
        onProgress: (step) => this.setProgress(id, step),
        onUploaded: async (key, mediaId) => {
          current = { ...current, media: current.media.map((media) => (media.key === key ? { ...media, mediaId } : media)) };
          await store.save({ ...current, state: 'queued' }).catch(() => undefined);
        },
      });
      posted = true;
    } catch (error) {
      failure = error;
    }

    this.sending = null;
    this.setProgress(id, undefined);
    if (posted) {
      this.fails = 0;
      this.resent.delete(id);
      await this.forget([id]);
      onPosted(draft.journeyId);
    } else if (!this.find(id)) {
      // Its journey or its account was deleted while it was going up: it is not put back.
      await store.remove(id).catch(() => undefined);
    } else {
      const next = this.afterFailure(current, failure);
      await store.save(next).catch(() => undefined);
      this.put(next);
    }
    this.pump();
  }

  /** What an entry becomes after a try that failed: back in line for later, or "couldn't upload" with a sentence. */
  private afterFailure(current: Draft, error: unknown): Draft {
    const id = current.clientId;
    if (uploadsForgotten(error) && !this.resent.has(id)) {
      // Its files went up so long ago that the API cleared them out. Send them again, once.
      this.resent.add(id);
      return { ...current, state: 'queued', media: current.media.map((media) => ({ ...media, mediaId: undefined })) };
    }
    const failed = (problem: string): Draft => {
      this.waiting.delete(id);
      return { ...current, state: 'failed', problem };
    };
    const how = howItFailed(error);
    if (how === 'refused') return failed(messageFor(error));

    const now = Date.now();
    const wait = this.waiting.get(id) ?? { tries: 0, since: now, notBefore: 0 };
    wait.tries += 1;
    if (how === 'unreachable') {
      // Usually the connection: everything rests a while. But when the API answered other requests since
      // this entry first got no answer, it is this entry that can't get through.
      if (wait.tries >= STUCK_AFTER && lastAnswerAt() > wait.since) return failed(STUCK);
      this.fails += 1;
      this.restUntil = now + restFor(this.fails);
    } else if (wait.tries >= MOST_TRIES) {
      return failed(messageFor(error));
    }
    wait.notBefore = now + waitFor(wait.tries);
    this.waiting.set(id, wait);
    return { ...current, state: 'queued' };
  }
}
