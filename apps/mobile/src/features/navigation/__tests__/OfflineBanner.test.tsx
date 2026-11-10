import { render, screen } from '@testing-library/react-native';
import { usePathname } from 'expo-router';

import { useOnline } from '@/api/online';

import { OfflineBanner } from '../OfflineBanner';

jest.mock('expo-router', () => ({ usePathname: jest.fn() }));
jest.mock('@/api/online', () => ({ useOnline: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const online = jest.mocked(useOnline);
const path = jest.mocked(usePathname);

describe('the offline mark', () => {
  it('shows when the phone has no connection and goes when it is back', async () => {
    path.mockReturnValue('/journey/j1/timeline');
    online.mockReturnValue(false);
    const view = await render(<OfflineBanner />);
    expect(screen.getByLabelText("You're offline. Showing what you read recently.")).toBeTruthy();

    online.mockReturnValue(true);
    await view.rerender(<OfflineBanner />);
    expect(screen.queryByLabelText(/offline/)).toBeNull();
  });

  it('stays away from screens that say it in their own words', async () => {
    online.mockReturnValue(false);
    for (const own of ['/uploads', '/journey/j1/add']) {
      path.mockReturnValue(own);
      const view = await render(<OfflineBanner />);
      expect(screen.queryByLabelText(/offline/)).toBeNull();
      await view.unmount();
    }
  });
});
