import { renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { runBeforeSignOut } from '@/auth/beforeSignOut';

import { analyticsOn, countChanges, forgetPerson, identify, track } from '../analytics';
import { useTelemetry } from '../useTelemetry';

jest.mock('../analytics', () => ({
  analyticsOn: jest.fn(() => true),
  countChanges: jest.fn(() => () => {}),
  forgetPerson: jest.fn(),
  identify: jest.fn(),
  startAnalytics: jest.fn(),
  track: jest.fn(),
}));
jest.mock('../crashes', () => ({ startCrashReports: jest.fn() }));

/** The phone tells the app that it was put away or brought back. */
let appState: (state: AppStateStatus) => void = () => {};

describe('counting, switched on for the whole app', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(analyticsOn).mockReturnValue(true);
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      appState = listener as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
  });

  it('counts "opened the app" at the start and each time it comes back from being put away, with nothing attached', async () => {
    await renderHook(() => useTelemetry(undefined));
    expect(jest.mocked(track).mock.calls).toEqual([['app_opened']]);
    expect(countChanges).toHaveBeenCalledTimes(1);

    // A question from the phone on top of the app is not "away".
    appState('inactive');
    appState('active');
    expect(track).toHaveBeenCalledTimes(1);

    appState('background');
    appState('active');
    expect(jest.mocked(track).mock.calls).toEqual([['app_opened'], ['app_opened']]);
  });

  it('ties counting to the account while someone is signed in, and forgets them however the sign-in ends', async () => {
    const view = await renderHook(({ accountId }: { accountId: string | undefined }) => useTelemetry(accountId), { initialProps: { accountId: undefined as string | undefined } });
    expect(identify).not.toHaveBeenCalled();

    await view.rerender({ accountId: 'account-1' });
    expect(identify).toHaveBeenCalledWith('account-1');

    // The session says the goodbyes before any sign-in ends: the person's own sign-out, or the service's.
    await runBeforeSignOut();
    expect(forgetPerson).toHaveBeenCalledTimes(1);
  });

  it('ties nothing to anyone in a build that does not count', async () => {
    jest.mocked(analyticsOn).mockReturnValue(false);
    await renderHook(() => useTelemetry('account-1'));
    expect(identify).not.toHaveBeenCalled();
    await runBeforeSignOut();
    expect(forgetPerson).not.toHaveBeenCalled();
  });
});
