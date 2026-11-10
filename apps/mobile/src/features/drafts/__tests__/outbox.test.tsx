import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { type ReactNode, useEffect } from 'react';
import { Pressable, Text } from 'react-native';

import { ApiError, apiFetch } from '@/api/fetcher';
import { addEntry } from '@/api/generated/journey';
import { useOnline } from '@/api/online';
import { uploadPhoto } from '@/api/upload';
import { sendClip } from '@/features/media/sendClip';

import { MOST_TRIES, OutboxEngine, STUCK_AFTER } from '../engine';
import { OutboxProvider, useOutbox, useProgress } from '../outbox';
import { howItFailed, isUnreachable, sendDraft } from '../send';
import type { Draft, DraftInput, DraftStore, Progress } from '../types';
import { draftContents, draftSaved, draftTitle, draftWhere, progressLine } from '../words';

const mockEntrySaved = jest.fn((_journeyId: string) => Promise.resolve());
jest.mock('@/api/online', () => ({ useOnline: jest.fn() }));
jest.mock('@/api/cache', () => ({ cacheFor: () => ({ entrySaved: mockEntrySaved }) }));
jest.mock('@/api/upload', () => ({ uploadPhoto: jest.fn() }));
jest.mock('@/features/media/sendClip', () => ({ sendClip: jest.fn() }));
jest.mock('@/api/generated/journey', () => ({ addEntry: jest.fn(), useGetMe: () => ({ data: { id: 'me' } }) }));
// The phone's own storage isn't there in a test; each test brings a store that lives in memory.
jest.mock('../store', () => ({ draftStore: {} }));

const network = jest.mocked(useOnline);
const photoUp = jest.mocked(uploadPhoto);
const clipUp = jest.mocked(sendClip);
const entryUp = jest.mocked(addEntry);

const input: DraftInput = {
  clientId: 'c1',
  journeyId: 'j1',
  journey: { title: 'Iceland ring road', startDate: '2026-04-01', labelStyle: 'day', template: 'trip', coverThumbUrl: null },
  title: 'Skógafoss in the rain',
  body: 'Soaked from fifty metres away.',
  day: '2026-04-07',
  dayLabel: 'Day 7',
  place: { name: 'Skógafoss, Iceland', lat: 63.53, lng: -19.51, exact: false },
  milestone: true,
  media: [
    { key: 'a', kind: 'photo', uri: 'file:///a.jpg', width: 100, height: 80 },
    { key: 'b', kind: 'photo', uri: 'file:///b.jpg', width: 100, height: 80 },
  ],
};
const draft = (over: Partial<Draft> = {}): Draft => ({ ...input, owner: 'me', state: 'queued', savedAt: '2026-04-07T10:00:00.000Z', ...over });
/** An entry of words only: nothing to upload before it. */
const words = (clientId: string, over: Partial<Draft> = {}): Draft => draft({ clientId, media: [], savedAt: `2026-04-07T10:00:0${clientId.slice(1)}.000Z`, ...over });

/** A store that lives in memory, like the phone's but without the phone. */
function memory(initial: Draft[] = []) {
  const rows = new Map(initial.map((row) => [row.clientId, row]));
  const store: DraftStore = {
    load: async (owner) => [...rows.values()].filter((row) => row.owner === owner),
    save: async (row) => void rows.set(row.clientId, row),
    remove: async (clientId) => void rows.delete(clientId),
    removeAll: async (owner) => {
      for (const row of [...rows.values()]) if (row.owner === owner) rows.delete(row.clientId);
    },
    keep: async (_clientId, media) => ({ ...media, file: `${media.key}.jpg` }),
  };
  return { rows, store };
}

/** How often the screen that lists the drafts has been drawn. */
const list = { drawn: 0 };

/** Shows what the outbox holds, with a button for each thing a screen does with it. */
function Probe() {
  const outbox = useOutbox();
  // After every time it is drawn (no list of what to watch: this runs each time).
  useEffect(() => {
    list.drawn += 1;
  });
  return (
    <>
      <Text>{outbox.drafts.map((row) => `${row.clientId}:${row.state}${row.problem ? `:${row.problem}` : ''}`).join(' | ') || 'empty'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="post" onPress={() => void outbox.save(input, 'post')} />
      <Pressable accessibilityRole="button" accessibilityLabel="draft" onPress={() => void outbox.save(input, 'draft')} />
      <Pressable accessibilityRole="button" accessibilityLabel="retry" onPress={() => outbox.retry('c1')} />
      <Pressable accessibilityRole="button" accessibilityLabel="hold" onPress={() => outbox.hold('c1')} />
      <Pressable accessibilityRole="button" accessibilityLabel="release" onPress={() => outbox.release('c1', 'queued')} />
      <Pressable accessibilityRole="button" accessibilityLabel="release a draft" onPress={() => outbox.release('c1', 'draft')} />
      <Pressable accessibilityRole="button" accessibilityLabel="discard" onPress={() => void outbox.discard('c1')} />
    </>
  );
}

/** The one place that draws how far an upload has come. */
function Bar() {
  const progress = useProgress('c1');
  return <Text>{progress ? `progress ${Math.round(progress.fraction * 100)}` : 'no progress'}</Text>;
}

const online = (isConnected: boolean) => network.mockReturnValue(isConnected);
const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false } } });
const app = (store: DraftStore, extra?: ReactNode) => (
  <QueryClientProvider client={client}>
    <OutboxProvider store={store}>
      <Probe />
      {extra}
    </OutboxProvider>
  </QueryClientProvider>
);

beforeEach(() => {
  jest.clearAllMocks();
  online(true);
  photoUp.mockImplementation(async (photo) => `media-${photo.uri.slice(-5, -4)}`);
  clipUp.mockResolvedValue('media-clip');
  entryUp.mockResolvedValue({ id: 'e1' } as Awaited<ReturnType<typeof addEntry>>);
});

describe('sending a draft', () => {
  it('sends the photos and clips that have not gone up, then the entry, with the place, the day and its own id', async () => {
    const steps: Progress[] = [];
    const uploaded: string[] = [];
    const mixed = draft({ media: [...input.media, { key: 'v', kind: 'video', uri: 'file:///v.mp4', width: 0, height: 0, durationSeconds: 12 }, { key: 'old', kind: 'photo', uri: 'file:///old.jpg', width: 1, height: 1, mediaId: 'media-old' }] });
    await sendDraft(mixed, { onProgress: (step) => steps.push(step), onUploaded: (key, mediaId) => void uploaded.push(`${key}=${mediaId}`) });

    expect(photoUp).toHaveBeenCalledTimes(2);
    expect(clipUp).toHaveBeenCalledTimes(1);
    expect(uploaded).toEqual(['a=media-a', 'b=media-b', 'v=media-clip']);
    expect(entryUp).toHaveBeenCalledWith(
      'j1',
      expect.objectContaining({
        clientId: 'c1',
        title: 'Skógafoss in the rain',
        placeName: 'Skógafoss, Iceland',
        lat: 63.53,
        lng: -19.51,
        locationPrecision: 'city',
        isMilestone: true,
        happenedOn: '2026-04-07',
        // In the order they sit in the entry, whether they went up now or earlier.
        mediaIds: ['media-a', 'media-b', 'media-clip', 'media-old'],
      }),
    );
    // "1 of 2 photos · then 1 clip", "2 of 2 photos · then 1 clip", the clip, then the entry itself.
    expect(steps.map((step) => `${step.kind} ${step.at}/${step.of} then ${step.then}`)).toEqual(['photo 1/2 then 1', 'photo 2/2 then 1', 'video 1/1 then 0', 'entry 0/0 then 0']);
    expect(steps.at(-1)!.fraction).toBeCloseTo(8 / 9);
  });

  it('posts an entry with the moment it was written, however much later it goes up', async () => {
    const written = new Date(2026, 3, 7, 9, 41, 12);
    await sendDraft(draft({ media: [], writtenAt: written.toISOString(), savedAt: '2026-04-09T18:00:00.000Z' }), { onProgress: () => {}, onUploaded: () => {} });
    expect(entryUp).toHaveBeenLastCalledWith('j1', expect.objectContaining({ happenedOn: '2026-04-07', happenedAt: written.toISOString() }));
  });

  it('says while a clip is still being made smaller, and how far the whole job has come', async () => {
    const steps: Progress[] = [];
    clipUp.mockImplementation(async (_clip, onProgress) => {
      onProgress?.(0.15, true);
      onProgress?.(0.65, false);
      return 'media-clip';
    });
    await sendDraft(draft({ media: [{ key: 'v', kind: 'video', uri: 'file:///v.mp4', width: 0, height: 0 }] }), { onProgress: (step) => steps.push(step), onUploaded: () => {} });
    expect(steps.map((step) => progressLine(step, true))).toEqual(['Uploading the clip', 'Getting the clip ready', 'Uploading the clip', 'Posting']);
    expect(steps[1]!.fraction).toBeCloseTo((6 * 0.15) / 7);
  });

  it('tells "nothing answered" from "not now" and from a plain no', () => {
    expect(isUnreachable(new ApiError(0, 'unreachable', 'No connection'))).toBe(true);
    expect(isUnreachable(new ApiError(400, 'invalid', 'No'))).toBe(false);
    expect(isUnreachable(new Error('boom'))).toBe(false);
    expect(howItFailed(new ApiError(0, 'unreachable', 'No connection'))).toBe('unreachable');
    // The API stumbled, is busy, took too long, is being updated; or the sign-in has to be renewed first.
    for (const status of [500, 502, 503, 429, 408, 401]) expect(howItFailed(new ApiError(status, 'error', 'Not now'))).toBe('later');
    for (const status of [400, 403, 404, 413, 422]) expect(howItFailed(new ApiError(status, 'error', 'No'))).toBe('refused');
    expect(howItFailed(new Error('boom'))).toBe('refused');
  });
});

describe('the outbox', () => {
  it('posts an entry in the background and forgets the draft once it is up', async () => {
    const { rows, store } = memory();
    await render(app(store));
    await userEvent.setup().press(screen.getByRole('button', { name: 'post' }));

    await waitFor(() => expect(entryUp).toHaveBeenCalledTimes(1));
    expect(entryUp).toHaveBeenCalledWith('j1', expect.objectContaining({ clientId: 'c1', mediaIds: ['media-a', 'media-b'] }));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect(rows.size).toBe(0);
    expect(mockEntrySaved).toHaveBeenCalledWith('j1');
  });

  it('keeps an entry written offline and sends it by itself, once, when the phone is back', async () => {
    online(false);
    const { rows, store } = memory();
    const view = await render(app(store));
    await userEvent.setup().press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    expect(rows.get('c1')?.media.map((media) => media.file)).toEqual(['a.jpg', 'b.jpg']); // its photos are kept on the phone
    expect(rows.get('c1')?.writtenAt).toEqual(expect.any(String)); // and when it was written
    expect(photoUp).not.toHaveBeenCalled();
    expect(entryUp).not.toHaveBeenCalled();

    online(true);
    await view.rerender(app(store));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect(entryUp).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(0);
  });

  it('picks up what was waiting from the last time the app was open', async () => {
    const { store } = memory([draft(), draft({ clientId: 'theirs', owner: 'someone-else' })]);
    await render(app(store));
    await waitFor(() => expect(entryUp).toHaveBeenCalledTimes(1));
    // Another person's draft on the same phone is neither shown nor sent.
    expect(entryUp).toHaveBeenCalledWith('j1', expect.objectContaining({ clientId: 'c1' }));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
  });

  it('says why an entry was refused, and Retry sends only what has not gone up yet', async () => {
    photoUp.mockResolvedValueOnce('media-a').mockRejectedValueOnce(new ApiError(400, 'file_gone', "A photo of this entry can't be read any more."));
    const { rows, store } = memory();
    await render(app(store));
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(screen.getByText("c1:failed:A photo of this entry can't be read any more.")).toBeOnTheScreen());
    expect(entryUp).not.toHaveBeenCalled();
    expect(rows.get('c1')?.media.map((media) => media.mediaId)).toEqual(['media-a', undefined]);

    photoUp.mockResolvedValueOnce('media-b');
    await user.press(screen.getByRole('button', { name: 'retry' }));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect(photoUp).toHaveBeenCalledTimes(3); // a, b (failed), b again: never a twice
    expect(entryUp).toHaveBeenCalledWith('j1', expect.objectContaining({ mediaIds: ['media-a', 'media-b'] }));
  });

  it('leaves an entry in line when nothing answered, instead of calling it failed', async () => {
    entryUp.mockRejectedValueOnce(new ApiError(0, 'unreachable', "Can't reach Journey right now."));
    const { rows, store } = memory();
    const view = await render(app(store));
    await userEvent.setup().press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(entryUp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    // The photos went up before the connection dropped; they are remembered for the next try.
    expect(rows.get('c1')?.media.map((media) => media.mediaId)).toEqual(['media-a', 'media-b']);
    await view.unmount(); // (the line is resting before its next try; nothing is left running)
  });

  it('keeps a draft until its author posts or deletes it, and holding takes one out of the line', async () => {
    online(false);
    const { rows, store } = memory();
    await render(app(store));
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'draft' }));
    await waitFor(() => expect(screen.getByText('c1:draft')).toBeOnTheScreen());
    await user.press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    await user.press(screen.getByRole('button', { name: 'hold' }));
    await waitFor(() => expect(screen.getByText('c1:draft')).toBeOnTheScreen());
    expect(rows.get('c1')?.state).toBe('draft');
    // Only looked at, and closed without a change: it goes back in line. One that was a draft before stays a draft.
    await user.press(screen.getByRole('button', { name: 'release a draft' }));
    expect(screen.getByText('c1:draft')).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'release' }));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    expect(rows.get('c1')?.state).toBe('queued');
    await user.press(screen.getByRole('button', { name: 'hold' }));
    await waitFor(() => expect(screen.getByText('c1:draft')).toBeOnTheScreen());
    await user.press(screen.getByRole('button', { name: 'discard' }));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect(rows.size).toBe(0);
    expect(entryUp).not.toHaveBeenCalled();
  });

  it('does not draw the screens that list drafts again while an upload moves on; only what shows its progress', async () => {
    let moveOn: (fraction: number) => void = () => {};
    let finish: (mediaId: string) => void = () => {};
    clipUp.mockImplementation(
      (_clip, onProgress) =>
        new Promise<string>((resolve) => {
          moveOn = (fraction) => onProgress?.(fraction, false);
          finish = resolve;
        }),
    );
    const { store } = memory([draft({ media: [{ key: 'v', kind: 'video', uri: 'file:///v.mp4', width: 0, height: 0 }] })]);
    await render(app(store, <Bar />));
    await waitFor(() => expect(screen.getByText('c1:sending')).toBeOnTheScreen());
    await waitFor(() => expect(screen.getByText('progress 0')).toBeOnTheScreen());

    const drawn = list.drawn;
    // A clip reports many times a second. The bar follows, a few times a second; the list is left alone.
    for (let step = 1; step <= 40; step += 1) await act(async () => moveOn(step / 50));
    await waitFor(() => expect(screen.getByText('progress 69')).toBeOnTheScreen());
    expect(list.drawn).toBe(drawn);

    await act(async () => finish('media-clip'));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect(screen.getByText('no progress')).toBeOnTheScreen();
    expect(list.drawn).toBeGreaterThan(drawn); // it is drawn again when the list itself changes
  });

  it('removes what was waiting for a journey that was deleted, and everything when the account is deleted', async () => {
    online(false);
    const { rows, store } = memory([words('c1'), words('c2', { journeyId: 'j2' }), words('c3', { journeyId: 'j2', state: 'draft' }), words('c9', { owner: 'someone-else' })]);
    await render(app(store));
    await waitFor(() => expect(screen.getByText('c1:queued | c2:queued | c3:draft')).toBeOnTheScreen());

    // Whichever screen deletes it: the outbox hears the API say yes.
    globalThis.fetch = jest.fn(() => Promise.resolve(new Response(null, { status: 204 }))) as unknown as typeof fetch;
    await act(async () => void (await apiFetch('/v1/journeys/j2', { method: 'DELETE' })));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    expect([...rows.keys()].sort()).toEqual(['c1', 'c9']);

    await act(async () => void (await apiFetch('/v1/me', { method: 'DELETE' })));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect([...rows.keys()]).toEqual(['c9']); // another person's drafts on this phone are theirs
    expect(entryUp).not.toHaveBeenCalled();
  });
});

describe('the line, when a try fails', () => {
  const posted = () => entryUp.mock.calls.map(([, body]) => (body as { clientId: string }).clientId);
  const notNow = new ApiError(503, 'error', 'Something went wrong on our side. Try again.');
  const noAnswer = new ApiError(0, 'unreachable', "Can't reach Journey right now.");
  /** Lets everything that is ready to happen, happen: answers that arrived, timers that are due. */
  const settle = (ms = 0) => jest.advanceTimersByTimeAsync(ms);

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const begin = async (drafts: Draft[]) => {
    const { rows, store } = memory(drafts);
    const engine = new OutboxEngine({ store, owner: 'me', onPosted: (journeyId) => void mockEntrySaved(journeyId) });
    engine.start();
    await settle();
    const states = () => engine.getDrafts().map((row) => `${row.clientId}:${row.state}`).join(' | ') || 'empty';
    return { engine, rows, states };
  };

  it('tries again by itself after "not now", waiting longer each time', async () => {
    entryUp.mockRejectedValueOnce(notNow).mockRejectedValueOnce(notNow);
    const { engine, states } = await begin([words('c1')]);
    expect(states()).toBe('c1:queued'); // not "couldn't upload": a deploy takes a minute
    expect(entryUp).toHaveBeenCalledTimes(1);

    await settle(9_000);
    expect(entryUp).toHaveBeenCalledTimes(1);
    await settle(1_000); // 10 seconds after the first try
    expect(entryUp).toHaveBeenCalledTimes(2);
    await settle(19_000);
    expect(entryUp).toHaveBeenCalledTimes(2);
    await settle(1_000); // 20 seconds after the second
    expect(entryUp).toHaveBeenCalledTimes(3);
    expect(states()).toBe('empty');
    engine.stop();
  });

  it('gives up after a while with the API\'s own words, and Retry starts afresh', async () => {
    entryUp.mockRejectedValue(notNow);
    const { engine, rows } = await begin([words('c1')]);
    await settle(60 * 60 * 1000);
    expect(entryUp).toHaveBeenCalledTimes(MOST_TRIES);
    expect(rows.get('c1')).toMatchObject({ state: 'failed', problem: 'Something went wrong on our side. Try again.' });

    entryUp.mockResolvedValue({ id: 'e1' } as Awaited<ReturnType<typeof addEntry>>);
    engine.retry('c1');
    await settle();
    expect(rows.size).toBe(0);
    engine.stop();
  });

  it('never lets one stuck entry hold up the ones behind it', async () => {
    entryUp.mockImplementation(async (_journeyId, body) => {
      if ((body as { clientId: string }).clientId === 'c1') throw notNow;
      return { id: 'e' } as Awaited<ReturnType<typeof addEntry>>;
    });
    const { engine, states } = await begin([words('c1'), words('c2'), words('c3')]);
    // The oldest was tried first and has to wait; the two behind it went up meanwhile.
    expect(posted()).toEqual(['c1', 'c2', 'c3']);
    expect(states()).toBe('c1:queued');
    engine.stop();
  });

  it('rests after nothing answered, and tries at once when the phone is back', async () => {
    entryUp.mockRejectedValueOnce(noAnswer);
    const { engine, states } = await begin([words('c1'), words('c2')]);
    // No connection after all: nobody else is tried either, for a quarter of a minute.
    expect(posted()).toEqual(['c1']);
    await settle(14_000);
    expect(posted()).toEqual(['c1']);

    engine.setOnline(false);
    engine.setOnline(true);
    await settle();
    expect(posted()).toEqual(['c1', 'c2', 'c1']); // the one that hasn't failed goes first
    expect(states()).toBe('empty');
    engine.stop();
  });

  it('calls an entry stuck when it gets no answer again and again while the API answers everything else', async () => {
    entryUp.mockRejectedValue(noAnswer);
    globalThis.fetch = jest.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as unknown as typeof fetch;
    const { engine, rows } = await begin([words('c1')]);
    // Without any other answer it is "no connection": it is tried for as long as it takes.
    await settle(30 * 60 * 1000);
    expect(rows.get('c1')?.state).toBe('queued');
    const before = entryUp.mock.calls.length;
    expect(before).toBeGreaterThan(STUCK_AFTER);

    // The app reads something else, and the API answers. Then it isn't the connection.
    await apiFetch('/v1/feed');
    await settle(10 * 60 * 1000);
    expect(entryUp.mock.calls.length).toBe(before + 1);
    expect(rows.get('c1')).toMatchObject({ state: 'failed', problem: expect.stringContaining('keeps failing to upload') });
    engine.stop();
  });

  it('keeps an entry in line when its author was signed out meanwhile, instead of calling it failed', async () => {
    entryUp.mockRejectedValueOnce(new ApiError(401, 'signed_out', 'Please sign in again.'));
    const { engine, rows } = await begin([words('c1')]);
    engine.stop(); // the signed-in part of the app has gone
    await settle(60_000);
    expect(rows.get('c1')?.state).toBe('queued');
    expect(entryUp).toHaveBeenCalledTimes(1);
  });
});

describe('the words for a draft', () => {
  it('names it by its title, or how it starts, or what it holds', () => {
    expect(draftTitle(draft())).toBe('Skógafoss in the rain');
    expect(draftTitle(draft({ title: ' ', body: 'Nobody else on the path.\nThe spray soaks you.' }))).toBe('Nobody else on the path. The spray soaks you.');
    expect(draftTitle(draft({ title: '', body: '' }))).toBe('2 photos');
    expect(draftTitle(draft({ title: '', body: '', media: [] }))).toBe('Untitled entry');
  });

  it('says what it holds, where it belongs and when it was saved', () => {
    expect(draftContents(draft({ media: [] }))).toBe('Text only');
    expect(draftContents(draft({ media: [...input.media, { key: 'v', kind: 'video', uri: 'v', width: 0, height: 0 }] }))).toBe('2 photos · 1 clip');
    expect(draftWhere(draft())).toBe('Iceland ring road · Day 7');
    expect(draftSaved(draft({ media: [] }), new Date('2026-04-07T12:05:00.000Z'))).toBe('Text only · saved 2h ago');
  });

  it('says what is going up, or what it is waiting for', () => {
    expect(progressLine({ kind: 'photo', at: 4, of: 6, then: 1, fraction: 0.5 }, true)).toBe('4 of 6 photos · then 1 clip');
    expect(progressLine({ kind: 'video', at: 1, of: 1, then: 0, fraction: 0.5 }, true)).toBe('Uploading the clip');
    expect(progressLine({ kind: 'video', at: 2, of: 3, then: 2, fraction: 0.5 }, true)).toBe('Clip 2 of 3 · then 2 photos');
    expect(progressLine({ kind: 'video', at: 2, of: 3, then: 0, fraction: 0.5, preparing: true }, true)).toBe('Getting clip 2 of 3 ready');
    expect(progressLine({ kind: 'entry', at: 0, of: 0, then: 0, fraction: 0.9 }, true)).toBe('Posting');
    expect(progressLine(undefined, true)).toBe('Waiting for its turn');
    expect(progressLine(undefined, false)).toBe('Waiting for a connection');
  });
});
