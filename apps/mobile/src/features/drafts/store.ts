import { Directory, File, Paths } from 'expo-file-system';
import * as SQLite from 'expo-sqlite';

import type { Draft, DraftMedia, DraftStore } from './types';

/**
 * Drafts on the phone: one row each in a small SQLite database, and each draft's photos and clips in a folder
 * of its own inside the app's documents (so the phone doesn't clear them the way it clears a cache).
 */
let opened: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * The version of what is kept, written into the database itself. When the table or the shape of a draft has
 * to change, raise this and add the step that brings an older database up to it (`if (version < 2) …`).
 */
const VERSION = 1;

function database(): Promise<SQLite.SQLiteDatabase> {
  opened ??= SQLite.openDatabaseAsync('outbox.db').then(async (db) => {
    const version = (await db.getFirstAsync<{ user_version: number }>('pragma user_version'))?.user_version ?? 0;
    if (version < 1) {
      await db.execAsync(
        'create table if not exists drafts (client_id text primary key not null, owner text not null, journey_id text not null, state text not null, payload text not null, saved_at text not null)',
      );
    }
    if (version < VERSION) await db.execAsync(`pragma user_version = ${VERSION}`);
    return db;
  });
  return opened;
}

const folderOf = (clientId: string) => new Directory(Paths.document, 'drafts', clientId);

function removeFolder(clientId: string) {
  const folder = folderOf(clientId);
  if (folder.exists) folder.delete();
}

/** The app's folder moves when the app is updated, so a kept file is found by its name, not by its old address. */
function located(clientId: string, media: DraftMedia): DraftMedia {
  return media.file ? { ...media, uri: new File(folderOf(clientId), media.file).uri } : media;
}

export const draftStore: DraftStore = {
  async load(owner) {
    const db = await database();
    const stored = await db.getAllAsync<{ payload: string }>('select payload from drafts where owner = ? order by saved_at', owner);
    const drafts: Draft[] = [];
    for (const row of stored) {
      try {
        const draft = JSON.parse(row.payload) as Draft;
        // One that was going up when the app closed takes its turn again.
        drafts.push({ ...draft, state: draft.state === 'sending' ? 'queued' : draft.state, media: draft.media.map((media) => located(draft.clientId, media)) });
      } catch {
        // A row that can't be read is left alone rather than shown broken.
      }
    }
    return drafts;
  },

  async save(draft) {
    const db = await database();
    await db.runAsync(
      'insert into drafts (client_id, owner, journey_id, state, payload, saved_at) values (?, ?, ?, ?, ?, ?) ' +
        'on conflict (client_id) do update set owner = excluded.owner, journey_id = excluded.journey_id, state = excluded.state, payload = excluded.payload, saved_at = excluded.saved_at',
      draft.clientId,
      draft.owner,
      draft.journeyId,
      draft.state,
      JSON.stringify(draft),
      draft.savedAt,
    );
  },

  async remove(clientId) {
    const db = await database();
    await db.runAsync('delete from drafts where client_id = ?', clientId);
    removeFolder(clientId);
  },

  async removeAll(owner) {
    const db = await database();
    const theirs = await db.getAllAsync<{ client_id: string }>('select client_id from drafts where owner = ?', owner);
    await db.runAsync('delete from drafts where owner = ?', owner);
    for (const row of theirs) removeFolder(row.client_id);
  },

  async keep(clientId, media) {
    if (media.mediaId || media.file) return media;
    const folder = folderOf(clientId);
    if (!folder.exists) folder.create({ intermediates: true, idempotent: true });
    const source = new File(media.uri);
    const name = `${media.key}${source.extension || (media.kind === 'video' ? '.mp4' : '.jpg')}`;
    const target = new File(folder, name);
    if (!target.exists) await source.copy(target);
    return { ...media, file: name, uri: target.uri };
  },
};
