import { act, render, screen, userEvent } from '@testing-library/react-native';

import { apiFetch } from '@/api/fetcher';
import { track } from '@/features/analytics/analytics';
import { onPhone } from '@/test/phone';

import { AskAboutNotifications } from '../AskAboutNotifications';
import { askedAboutPush, shouldAskAboutPush, turnOnPush } from '../device';
import { pushSupport } from '../support';

jest.mock('../device', () => ({ shouldAskAboutPush: jest.fn(), askedAboutPush: jest.fn(async () => undefined), turnOnPush: jest.fn() }));
jest.mock('../support', () => ({ pushSupport: jest.fn() }));
jest.mock('@/features/analytics/analytics', () => ({ track: jest.fn() }));

const support = jest.mocked(pushSupport);
const worthAsking = jest.mocked(shouldAskAboutPush);
const seen = jest.mocked(askedAboutPush);
const turnOn = jest.mocked(turnOnPush);

/** The app does something, and the API says yes. */
const did = async (method: string, path: string) => {
  globalThis.fetch = jest.fn(() => Promise.resolve(new Response('{}', { status: 200 }))) as unknown as typeof fetch;
  await act(async () => void (await apiFetch(path, { method })));
};
const QUESTION = "Know when there's a new chapter";

describe('asking about notifications inside the app', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
    support.mockReturnValue('ready');
    worthAsking.mockResolvedValue(true);
    turnOn.mockResolvedValue('on');
  });
  afterEach(() => jest.useRealTimers());

  it('never asks when the app opens, or for reading; it waits until the person has followed something or posted', async () => {
    await render(onPhone(<AskAboutNotifications />));
    await act(async () => void (await jest.advanceTimersByTimeAsync(5000)));
    expect(screen.queryByText(QUESTION)).toBeNull();

    await did('GET', '/v1/feed');
    await did('PUT', '/v1/entries/e1/like');
    await act(async () => void (await jest.advanceTimersByTimeAsync(5000)));
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(worthAsking).not.toHaveBeenCalled();

    await did('PUT', '/v1/journeys/j1/follow');
    expect(screen.queryByText(QUESTION)).toBeNull(); // first the screen shows what was just done
    await act(async () => void (await jest.advanceTimersByTimeAsync(900)));
    expect(screen.getByText(QUESTION)).toBeOnTheScreen();
    expect(seen).toHaveBeenCalledTimes(1); // remembered on this phone as soon as it is shown
  });

  it('gives the reason first, and the phone asks only after a yes', async () => {
    await render(onPhone(<AskAboutNotifications />));
    await did('POST', '/v1/journeys/j1/entries');
    await act(async () => void (await jest.advanceTimersByTimeAsync(900)));
    expect(turnOn).not.toHaveBeenCalled();

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole('button', { name: 'Turn on notifications' }));

    expect(turnOn).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith('notifications_answered', { answer: 'on', during: 'app' });
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it('takes "not now" for an answer', async () => {
    await render(onPhone(<AskAboutNotifications />));
    await did('PUT', '/v1/profiles/maya/follow');
    await act(async () => void (await jest.advanceTimersByTimeAsync(900)));

    await userEvent.setup({ advanceTimers: jest.advanceTimersByTime }).press(screen.getByRole('button', { name: 'Not now' }));

    expect(turnOn).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('notifications_answered', { answer: 'later', during: 'app' });
    expect(screen.queryByText(QUESTION)).toBeNull();
  });

  it('does not ask someone who has seen the question, or whose phone has answered already', async () => {
    worthAsking.mockResolvedValue(false);
    await render(onPhone(<AskAboutNotifications />));
    await did('PUT', '/v1/journeys/j1/follow');
    await act(async () => void (await jest.advanceTimersByTimeAsync(5000)));
    expect(screen.queryByText(QUESTION)).toBeNull();
    expect(seen).not.toHaveBeenCalled();
  });

  it('does nothing at all where notifications cannot work', async () => {
    support.mockReturnValue('browser');
    await render(onPhone(<AskAboutNotifications />));
    await did('PUT', '/v1/journeys/j1/follow');
    await act(async () => void (await jest.advanceTimersByTimeAsync(5000)));
    expect(worthAsking).not.toHaveBeenCalled();
    expect(screen.queryByText(QUESTION)).toBeNull();
  });
});
