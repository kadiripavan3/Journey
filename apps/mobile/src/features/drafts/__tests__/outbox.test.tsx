import { render, screen, userEvent, waitFor } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { ApiError } from '@/api/fetcher';
import { addEntry } from '@/api/generated/journey';
import { useOnline } from '@/api/online';
import { uploadPhoto } from '@/api/upload';
import { sendClip } from '@/features/media/sendClip';

import { OutboxProvider, useOutbox } from '../outbox';
import { isUnreachable, sendDraft } from '../send';
import type { Draft, DraftInput, DraftStore, Progress } from '../types';
import { draftContents, draftSaved, draftTitle, draftWhere, progressLine } from '../words';

const mockEntrySaved = jest.fn(() => Promise.resolve());
jest.mock('@/api/online', () => ({ useOnline: jest.fn() }));
jest.mock('@/api/cache', () => ({ useCache: () => ({ entrySaved: mockEntrySaved }) }));
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

/** A store that lives in memory, like the phone's but without the phone. */
function memory(initial: Draft[] = []) {
  const rows = new Map(initial.map((row) => [row.clientId, row]));
  const store: DraftStore = {
    load: async (owner) => [...rows.values()].filter((row) => row.owner === owner),
    save: async (row) => void rows.set(row.clientId, row),
    remove: async (clientId) => void rows.delete(clientId),
    keep: async (_clientId, media) => ({ ...media, file: `${media.key}.jpg` }),
  };
  return { rows, store };
}

/** Shows what the outbox holds, with a button for each thing a screen does with it. */
function Probe() {
  const outbox = useOutbox();
  return (
    <>
      <Text>{outbox.drafts.map((row) => `${row.clientId}:${row.state}${row.problem ? `:${row.problem}` : ''}`).join(' | ') || 'empty'}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="post" onPress={() => void outbox.save(input, 'post')} />
      <Pressable accessibilityRole="button" accessibilityLabel="draft" onPress={() => void outbox.save(input, 'draft')} />
      <Pressable accessibilityRole="button" accessibilityLabel="retry" onPress={() => outbox.retry('c1')} />
      <Pressable accessibilityRole="button" accessibilityLabel="hold" onPress={() => outbox.hold('c1')} />
      <Pressable accessibilityRole="button" accessibilityLabel="discard" onPress={() => void outbox.discard('c1')} />
    </>
  );
}

const online = (isConnected: boolean) => network.mockReturnValue(isConnected);

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

  it('tells "nothing answered" from a refusal', () => {
    expect(isUnreachable(new ApiError(0, 'unreachable', 'No connection'))).toBe(true);
    expect(isUnreachable(new ApiError(400, 'invalid', 'No'))).toBe(false);
    expect(isUnreachable(new Error('boom'))).toBe(false);
  });
});

describe('the outbox', () => {
  it('posts an entry in the background and forgets the draft once it is up', async () => {
    const { rows, store } = memory();
    await render(
      <OutboxProvider store={store}>
        <Probe />
      </OutboxProvider>,
    );
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
    const view = await render(
      <OutboxProvider store={store}>
        <Probe />
      </OutboxProvider>,
    );
    await userEvent.setup().press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    expect(rows.get('c1')?.media.map((media) => media.file)).toEqual(['a.jpg', 'b.jpg']); // its photos are kept on the phone
    expect(photoUp).not.toHaveBeenCalled();
    expect(entryUp).not.toHaveBeenCalled();

    online(true);
    await view.rerender(
      <OutboxProvider store={store}>
        <Probe />
      </OutboxProvider>,
    );
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect(entryUp).toHaveBeenCalledTimes(1);
    expect(rows.size).toBe(0);
  });

  it('picks up what was waiting from the last time the app was open', async () => {
    const { store } = memory([draft(), draft({ clientId: 'theirs', owner: 'someone-else' })]);
    await render(
      <OutboxProvider store={store}>
        <Probe />
      </OutboxProvider>,
    );
    await waitFor(() => expect(entryUp).toHaveBeenCalledTimes(1));
    // Another person's draft on the same phone is neither shown nor sent.
    expect(entryUp).toHaveBeenCalledWith('j1', expect.objectContaining({ clientId: 'c1' }));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
  });

  it('says why an entry was refused, and Retry sends only what has not gone up yet', async () => {
    photoUp.mockResolvedValueOnce('media-a').mockRejectedValueOnce(new ApiError(500, 'upload_failed', "A photo couldn't be uploaded. Try again."));
    const { rows, store } = memory();
    await render(
      <OutboxProvider store={store}>
        <Probe />
      </OutboxProvider>,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(screen.getByText("c1:failed:A photo couldn't be uploaded. Try again.")).toBeOnTheScreen());
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
    await render(
      <OutboxProvider store={store}>
        <Probe />
      </OutboxProvider>,
    );
    await userEvent.setup().press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(entryUp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    // The photos went up before the connection dropped; they are remembered for the next try.
    expect(rows.get('c1')?.media.map((media) => media.mediaId)).toEqual(['media-a', 'media-b']);
  });

  it('keeps a draft until its author posts or deletes it, and holding takes one out of the line', async () => {
    online(false);
    const { rows, store } = memory();
    await render(
      <OutboxProvider store={store}>
        <Probe />
      </OutboxProvider>,
    );
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'draft' }));
    await waitFor(() => expect(screen.getByText('c1:draft')).toBeOnTheScreen());
    await user.press(screen.getByRole('button', { name: 'post' }));
    await waitFor(() => expect(screen.getByText('c1:queued')).toBeOnTheScreen());
    await user.press(screen.getByRole('button', { name: 'hold' }));
    await waitFor(() => expect(screen.getByText('c1:draft')).toBeOnTheScreen());
    expect(rows.get('c1')?.state).toBe('draft');
    await user.press(screen.getByRole('button', { name: 'discard' }));
    await waitFor(() => expect(screen.getByText('empty')).toBeOnTheScreen());
    expect(rows.size).toBe(0);
    expect(entryUp).not.toHaveBeenCalled();
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
    expect(progressLine({ kind: 'entry', at: 0, of: 0, then: 0, fraction: 0.9 }, true)).toBe('Posting');
    expect(progressLine(undefined, true)).toBe('Waiting for its turn');
    expect(progressLine(undefined, false)).toBe('Waiting for a connection');
  });
});
