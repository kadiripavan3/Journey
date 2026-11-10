import { MutationObserver, onlineManager } from '@tanstack/react-query';

import { makeQueryClient } from '../client';
import { ApiError, unreachable } from '../fetcher';

describe('the data layer', () => {
  afterEach(() => onlineManager.setOnline(true));

  it('fails a change at once without a connection, with the app\'s own sentence: nothing waits in silence', async () => {
    jest.useFakeTimers();
    try {
      const client = makeQueryClient();
      onlineManager.setOnline(false);
      // (gcTime: no timer is left behind, so the test run can end.)
      const like = new MutationObserver(client, { mutationFn: () => Promise.reject(unreachable()), gcTime: Infinity });

      await expect(like.mutate()).rejects.toMatchObject({ code: 'unreachable' });

      expect(like.getCurrentResult()).toMatchObject({ isPending: false, isPaused: false, isError: true });
      client.clear();
      // The offline strip says "that didn't go through" for a few seconds; let that run out.
      await jest.advanceTimersByTimeAsync(5000);
    } finally {
      jest.useRealTimers();
    }
  });

  it('lets reading wait without a connection instead of failing', async () => {
    const client = makeQueryClient();
    client.mount(); // as the app's provider does: the client hears when the phone is back
    onlineManager.setOnline(false);
    const asked = jest.fn(() => Promise.resolve({ ok: true }));

    const answer = client.fetchQuery({ queryKey: ['/v1/feed'], queryFn: asked });
    await Promise.resolve();

    expect(asked).not.toHaveBeenCalled();
    expect(client.getQueryState(['/v1/feed'])).toMatchObject({ status: 'pending', fetchStatus: 'paused' });

    // Back online, it is asked by itself.
    onlineManager.setOnline(true);
    await expect(answer).resolves.toEqual({ ok: true });
    client.unmount();
    client.clear();
  });

  it('does not ask again for something that is not allowed or not there, and does for a server that stumbled', () => {
    const client = makeQueryClient();
    const retry = client.getDefaultOptions().queries?.retry as (failures: number, error: unknown) => boolean;
    expect(retry(0, new ApiError(404, 'not_found', 'Gone'))).toBe(false);
    expect(retry(0, new ApiError(503, 'error', 'Busy'))).toBe(true);
    expect(retry(2, new ApiError(503, 'error', 'Busy'))).toBe(false);
    client.clear();
  });

  it('knows every journey in the person\'s own list by itself, so its composer opens without asking', () => {
    const client = makeQueryClient();
    const listedAt = Date.now() - 5000;
    client.setQueryData(['/v1/journeys/j2'], { id: 'j2', title: 'Read a moment ago' });
    client.setQueryData(
      ['infinite', '/v1/me/journeys', { limit: 100 }],
      { pages: [{ items: [{ id: 'j1', title: 'Iceland ring road' }, { id: 'j2', title: 'From the list' }], nextCursor: null }], pageParams: [undefined] },
      { updatedAt: listedAt },
    );

    expect(client.getQueryData(['/v1/journeys/j1'])).toMatchObject({ title: 'Iceland ring road' });
    // As old as the list, so it is asked for again when there is a connection.
    expect(client.getQueryState(['/v1/journeys/j1'])?.dataUpdatedAt).toBe(listedAt);
    // What was read from the journey itself more recently stays.
    expect(client.getQueryData(['/v1/journeys/j2'])).toMatchObject({ title: 'Read a moment ago' });
    client.clear();
  });
});
