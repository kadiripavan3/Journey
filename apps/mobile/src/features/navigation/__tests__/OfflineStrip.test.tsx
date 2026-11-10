import { render, screen } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { useChangeNotSent, useOnline } from '@/api/online';
import { onPhone } from '@/test/phone';
import { darkTheme, themeFor } from '@/theme';

import { OfflineStrip, STRIP_HEIGHT } from '../OfflineStrip';

jest.mock('expo-router', () => ({ usePathname: jest.fn() }));
jest.mock('@/api/online', () => ({ useOnline: jest.fn(), useChangeNotSent: jest.fn() }));

const online = jest.mocked(useOnline);
const notSent = jest.mocked(useChangeNotSent);
const path = jest.mocked(usePathname);

const app = () =>
  onPhone(
    <OfflineStrip>
      <Text>The screens</Text>
    </OfflineStrip>,
  );
/** How far down the screens start. */
const pushedDownBy = () => StyleSheet.flatten(screen.getByText('The screens').parent?.props.style as object) as { marginTop: number };
const strip = () => screen.getByLabelText(/offline|go through/);

describe('the offline strip', () => {
  beforeEach(() => {
    notSent.mockReturnValue(false);
    path.mockReturnValue('/journey/j1/timeline');
  });

  it('shows across the top while the phone has no connection, makes room for itself, and goes when it is back', async () => {
    online.mockReturnValue(false);
    const view = await render(app());

    expect(strip().props.accessibilityLabel).toBe("You're offline. Showing what's saved on this phone.");
    // It covers the status bar's own area and one line under it; the screens start one line lower, so
    // nothing of theirs is underneath it.
    expect(StyleSheet.flatten(strip().props.style)).toMatchObject({ position: 'absolute', top: 0, height: 47 + STRIP_HEIGHT });
    expect(pushedDownBy().marginTop).toBe(STRIP_HEIGHT);

    online.mockReturnValue(true);
    await view.rerender(app());
    expect(screen.queryByLabelText(/offline/)).toBeNull();
    expect(pushedDownBy().marginTop).toBe(0);
  });

  it('stays away from screens that say it in their own words', async () => {
    online.mockReturnValue(false);
    for (const own of ['/uploads', '/journey/j1/add']) {
      path.mockReturnValue(own);
      const view = await render(app());
      expect(screen.queryByLabelText(/offline/)).toBeNull();
      expect(pushedDownBy().marginTop).toBe(0);
      await view.unmount();
    }
  });

  it('is dark above a screen whose top is a photo, so the clock above it stays readable', async () => {
    online.mockReturnValue(false);
    path.mockReturnValue('/journey/j1');
    const view = await render(app());
    expect(StyleSheet.flatten(strip().props.style)).toMatchObject({ backgroundColor: darkTheme.colors.stage });

    path.mockReturnValue('/journey/j1/timeline');
    await view.rerender(app());
    expect(StyleSheet.flatten(strip().props.style)).toMatchObject({ backgroundColor: themeFor('light').colors.bg });
  });

  it('says for a moment that a like or a follow did not go through', async () => {
    online.mockReturnValue(false);
    notSent.mockReturnValue(true);
    await render(app());
    expect(strip().props.accessibilityLabel).toBe("That didn't go through. Try again when you're back online.");
  });
});
