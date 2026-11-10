import { render, screen, userEvent } from '@testing-library/react-native';

import type { JourneyResponse } from '@/api/generated/journey';
import { runBeforeSignOut, beforeSignOut } from '@/auth/beforeSignOut';
import { PausedNote } from '@/features/journeys/PausedNote';

import { HOURS, hourLabel } from '../hours';
import { FALLBACK, hrefFor } from '../target';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

const ID = '0b9f6c1e-3a52-4d6f-9a51-6f0c2a1d7e42';

describe('where a notification opens the app', () => {
  it('opens the screen each kind of notification is about', () => {
    // These are the paths the API sends (PushWording in the API).
    expect(hrefFor(`/journey/${ID}/timeline`)).toBe(`/journey/${ID}/timeline`); // new entries
    expect(hrefFor(`/journey/${ID}/recap`)).toBe(`/journey/${ID}/recap`); // a journey was completed
    expect(hrefFor(`/entry/${ID}`)).toBe(`/entry/${ID}`); // likes
    expect(hrefFor(`/entry/${ID}?comments=1`)).toBe(`/entry/${ID}?comments=1`); // a comment or a reply
    expect(hrefFor('/profile/maya.o_k')).toBe('/profile/maya.o_k'); // a new follower
    expect(hrefFor(`/invitation/${ID}`)).toBe(`/invitation/${ID}`);
    expect(hrefFor(`/journey/${ID}/people`)).toBe(`/journey/${ID}/people`); // a friend joined
    expect(hrefFor(`/journey/${ID}/add`)).toBe(`/journey/${ID}/add`); // a reminder
    expect(hrefFor('/digest')).toBe('/digest');
    expect(hrefFor(`/journey/${ID}`)).toBe(`/journey/${ID}`); // paused by itself
  });

  it('lands on Activity for anything it does not know, rather than on a missing screen', () => {
    for (const strange of [undefined, null, 42, '', '/', '/settings/account', `/journey/${ID}/edit`, '/journey/not-an-id/timeline', `/entry/${ID}/extra/parts`, 'https://example.com/elsewhere', '/profile/some one']) {
      expect(hrefFor(strange)).toBe(FALLBACK);
    }
    // An entry opens as an entry whatever else is tacked on.
    expect(hrefFor(`/entry/${ID}?comments=1&x=2`)).toBe(`/entry/${ID}`);
  });
});

describe('the hour reminders arrive', () => {
  it('reads the way a person says it', () => {
    expect(hourLabel(19)).toBe('7:00 pm');
    expect(hourLabel(0)).toBe('12:00 am');
    expect(hourLabel(12)).toBe('12:00 pm');
    expect(hourLabel(9)).toBe('9:00 am');
  });

  it('offers every hour once, starting in the morning', () => {
    expect(HOURS).toHaveLength(24);
    expect(new Set(HOURS).size).toBe(24);
    expect(HOURS[0]).toBe(6);
  });
});

describe('before signing out', () => {
  it('runs every goodbye, survives one that fails, and can take one away again', async () => {
    const fine = jest.fn();
    const broken = jest.fn(() => Promise.reject(new Error('offline')));
    const removed = jest.fn();
    const stops = [beforeSignOut(fine), beforeSignOut(broken)];
    beforeSignOut(removed)();

    await expect(runBeforeSignOut()).resolves.toBeUndefined();

    expect(fine).toHaveBeenCalledTimes(1);
    expect(broken).toHaveBeenCalledTimes(1);
    expect(removed).not.toHaveBeenCalled();
    stops.forEach((stop) => stop());
  });

  it('does not wait for ever on a goodbye that hangs', async () => {
    jest.useFakeTimers();
    const stop = beforeSignOut(() => new Promise<void>(() => {}));
    const done = runBeforeSignOut();
    await jest.advanceTimersByTimeAsync(3000);
    await expect(done).resolves.toBeUndefined();
    stop();
    jest.useRealTimers();
  });
});

describe('PausedNote', () => {
  const journey = { id: ID, title: 'Building a tiny cabin', status: 'paused', pausedAutomatically: true, owner: { displayName: 'Nora Lind' }, viewer: { isOwner: true, isMember: false } } as JourneyResponse;

  beforeEach(() => mockPush.mockClear());

  it('tells the owner it paused by itself and offers both ways on', async () => {
    await render(<PausedNote journey={journey} />);
    expect(screen.getByText('Paused after 30 quiet days')).toBeOnTheScreen();
    expect(screen.getByText(/Add an entry whenever you're ready/)).toBeOnTheScreen();
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Add an entry' }));
    expect(mockPush).toHaveBeenLastCalledWith(`/journey/${ID}/add`);
    await user.press(screen.getByRole('button', { name: 'Complete it' }));
    expect(mockPush).toHaveBeenLastCalledWith(`/journey/${ID}/complete`);
  });

  it('tells a reader, without buttons, and does not claim 30 days for a journey its owner paused', async () => {
    await render(<PausedNote journey={{ ...journey, pausedAutomatically: false, viewer: { ...journey.viewer, isOwner: false } }} />);
    expect(screen.getByText('This journey is paused')).toBeOnTheScreen();
    expect(screen.getByText("You can still read it. You'll hear when Nora picks it up again.")).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Add an entry' })).not.toBeOnTheScreen();
  });

  it('lets a friend who writes in it add an entry, but only the owner complete it', async () => {
    await render(<PausedNote journey={{ ...journey, viewer: { ...journey.viewer, isOwner: false, isMember: true } }} />);
    expect(screen.getByRole('button', { name: 'Add an entry' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Complete it' })).not.toBeOnTheScreen();
  });
});
