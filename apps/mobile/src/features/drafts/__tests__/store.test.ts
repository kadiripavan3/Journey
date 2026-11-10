import type { Draft } from '../types';

/** A stand-in for the phone's database: remembers its version, its rows, and what it was asked to do. */
const mockDb = {
  version: 0,
  rows: new Map<string, { owner: string; payload: string; saved_at: string }>(),
  asked: [] as string[],
  async getFirstAsync(sql: string) {
    mockDb.asked.push(sql);
    return { user_version: mockDb.version };
  },
  async execAsync(sql: string) {
    mockDb.asked.push(sql);
    const set = /pragma user_version = (\d+)/.exec(sql);
    if (set) mockDb.version = Number(set[1]);
  },
  async getAllAsync(sql: string, owner: string) {
    const mine = [...mockDb.rows.entries()].filter(([, row]) => row.owner === owner).sort((a, b) => a[1].saved_at.localeCompare(b[1].saved_at));
    return sql.startsWith('select client_id') ? mine.map(([client_id]) => ({ client_id })) : mine.map(([, row]) => ({ payload: row.payload }));
  },
  async runAsync(sql: string, ...values: string[]) {
    if (sql.startsWith('insert')) mockDb.rows.set(values[0]!, { owner: values[1]!, payload: values[4]!, saved_at: values[5]! });
    else if (sql.includes('where client_id')) mockDb.rows.delete(values[0]!);
    else if (sql.includes('where owner')) for (const [id, row] of [...mockDb.rows]) if (row.owner === values[0]) mockDb.rows.delete(id);
  },
};
jest.mock('expo-sqlite', () => ({ openDatabaseAsync: async () => mockDb }));

const mockFolders = { existing: new Set<string>(), deleted: [] as string[] };
jest.mock('expo-file-system', () => ({
  Paths: { document: 'documents' },
  Directory: class {
    mockName: string;
    constructor(...parts: string[]) {
      this.mockName = parts.join('/');
    }
    get exists() {
      return mockFolders.existing.has(this.mockName);
    }
    delete() {
      mockFolders.existing.delete(this.mockName);
      mockFolders.deleted.push(this.mockName);
    }
  },
  File: class {
    uri: string;
    constructor(folder: { mockName: string }, name: string) {
      this.uri = `file:///${folder.mockName}/${name}`;
    }
  },
}));

const draft = (clientId: string, owner: string, over: Partial<Draft> = {}): Draft => ({
  clientId,
  owner,
  journeyId: 'j1',
  journey: { title: 'Iceland ring road', startDate: '2026-04-01', labelStyle: 'day', template: 'trip', coverThumbUrl: null },
  title: clientId,
  body: '',
  day: '2026-04-07',
  dayLabel: 'Day 7',
  place: null,
  milestone: false,
  media: [],
  state: 'queued',
  savedAt: `2026-04-07T10:00:00.00${clientId.slice(-1)}Z`,
  ...over,
});

/** The store as the app gets it the first time it runs. */
const fresh = () => {
  jest.resetModules();
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- on purpose: a new copy, so the database is opened again
  return (require('../store') as typeof import('../store')).draftStore;
};

describe('drafts on the phone', () => {
  beforeEach(() => {
    mockDb.version = 0;
    mockDb.rows.clear();
    mockDb.asked = [];
    mockFolders.existing.clear();
    mockFolders.deleted = [];
  });

  it('writes down the version of what it keeps, so the shape can change later without losing drafts', async () => {
    await fresh().load('me');
    expect(mockDb.version).toBe(1);
    expect(mockDb.asked.filter((sql) => sql.startsWith('create table'))).toHaveLength(1);

    // The next start finds its own version and leaves the table as it is.
    mockDb.asked = [];
    await fresh().load('me');
    expect(mockDb.asked).toEqual(['pragma user_version']);
  });

  it('brings a draft back as it was kept; one that was going up takes its turn again, and its files are found by name', async () => {
    const store = fresh();
    await store.save(draft('c1', 'me', { state: 'sending', writtenAt: '2026-04-07T09:41:12.000Z', media: [{ key: 'a', kind: 'photo', uri: 'file:///old-place/a.jpg', file: 'a.jpg', width: 1, height: 1 }] }));
    await store.save(draft('c2', 'someone-else'));

    const mine = await store.load('me');

    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ clientId: 'c1', state: 'queued', writtenAt: '2026-04-07T09:41:12.000Z' });
    expect(mine[0]!.media[0]!.uri).toBe('file:///documents/drafts/c1/a.jpg');
  });

  it('forgets everything of one person, with the files, and nothing of anyone else', async () => {
    const store = fresh();
    await store.save(draft('c1', 'me'));
    await store.save(draft('c2', 'me'));
    await store.save(draft('c3', 'someone-else'));
    mockFolders.existing = new Set(['documents/drafts/c1', 'documents/drafts/c3']);

    await store.removeAll('me');

    expect([...mockDb.rows.keys()]).toEqual(['c3']);
    expect(mockFolders.deleted).toEqual(['documents/drafts/c1']);
  });
});
