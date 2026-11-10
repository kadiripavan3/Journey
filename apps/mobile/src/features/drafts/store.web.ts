import type { Draft, DraftMedia, DraftStore } from './types';

/**
 * Drafts in a browser (the web preview): kept in the browser's own storage. The phone's SQLite and file
 * folder aren't used here. A photo picked in a browser only lasts until the page is closed, so after a
 * reload a draft comes back with its words and whatever was already uploaded, without the files that weren't.
 */
const KEY = 'journey.outbox.v1';

/** Picked files that are still alive in this page. */
const alive = new Set<string>();

function read(): Draft[] {
  try {
    const stored = globalThis.localStorage?.getItem(KEY);
    const drafts: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(drafts) ? (drafts as Draft[]) : [];
  } catch {
    return [];
  }
}

function write(drafts: Draft[]) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(drafts));
  } catch {
    // Storage that is full or switched off: the draft still lives for as long as the page is open.
  }
}

const usable = (media: DraftMedia) => !!media.mediaId || !media.uri.startsWith('blob:') || alive.has(media.uri);

export const draftStore: DraftStore = {
  async load(owner) {
    return read()
      .filter((draft) => draft.owner === owner)
      .map((draft) => ({ ...draft, state: draft.state === 'sending' ? ('queued' as const) : draft.state, media: draft.media.filter(usable) }))
      .sort((a, b) => a.savedAt.localeCompare(b.savedAt));
  },

  async save(draft) {
    write([...read().filter((other) => other.clientId !== draft.clientId), draft]);
  },

  async remove(clientId) {
    write(read().filter((draft) => draft.clientId !== clientId));
  },

  async keep(_clientId, media) {
    alive.add(media.uri);
    return media;
  },
};
