import { render, screen, userEvent } from '@testing-library/react-native';

import HeldForReview from '@/app/(app)/review/[id]';
import { saveRequest } from '@/features/entries/saveRequest';
import { onPhone } from '@/test/phone';
import { entry, loaded, photo } from '@/test/samples';

const mockChange = jest.fn();
const mockEntry = jest.fn();
jest.mock('expo-router', () => ({ useLocalSearchParams: () => ({ id: 'e1' }), useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/features/navigation/useLeave', () => ({ useLeave: () => jest.fn() }));
jest.mock('@/api/cache', () => ({ useCache: () => ({ entrySaved: jest.fn() }) }));
jest.mock('@/api/generated/journey', () => ({
  askSecondLook: jest.fn(),
  useGetEntry: () => mockEntry(),
  useChangeEntry: () => ({ mutate: mockChange, isPending: false, isError: false }),
}));

describe('Held for review', () => {
  it('"Remove the photo" keeps the entry\'s place, with its spot on the map', async () => {
    // One photo is fine, one is held. The entry has a place the author chose to show exactly.
    mockEntry.mockReturnValue(loaded(entry({ media: [photo('fine'), photo('flagged', { held: true })] })));
    await render(onPhone(<HeldForReview />));
    expect(screen.getByText('One photo is being reviewed')).toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Remove the photo' }));

    expect(mockChange).toHaveBeenCalledTimes(1);
    const sent = mockChange.mock.calls[0][0];
    expect(sent.id).toBe('e1');
    expect(sent.data.mediaIds).toEqual(['fine']);
    expect(sent.data).toMatchObject({ placeName: 'Vík, Iceland', lat: 63.4186, lng: -19.006, locationPrecision: 'exact' });
    expect(sent.data).toMatchObject({ title: 'Black sand and big waves', body: 'Reynisfjara at low tide.', happenedOn: '2026-04-08', happenedAt: '2026-04-08T14:00:00Z', isMilestone: false });
  });
});

describe('saving an entry again', () => {
  it('sends everything the entry has, so changing one thing loses nothing', () => {
    const e = entry({ isMilestone: true, locationPrecision: 'city', media: [photo('a'), photo('b')] });
    expect(saveRequest(e)).toEqual({
      title: e.title,
      body: e.body,
      placeName: 'Vík, Iceland',
      lat: 63.4186,
      lng: -19.006,
      locationPrecision: 'city',
      isMilestone: true,
      happenedOn: '2026-04-08',
      happenedAt: '2026-04-08T14:00:00Z',
      mediaIds: ['a', 'b'],
    });
  });

  it('sends a place that has only a name as a name, and no place as none', () => {
    expect(saveRequest(entry({ lat: null, lng: null }))).toMatchObject({ placeName: 'Vík, Iceland' });
    expect(saveRequest(entry({ lat: null, lng: null }))).not.toHaveProperty('lat');
    expect(saveRequest(entry({ placeName: null, lat: null, lng: null }))).toMatchObject({ placeName: '' });
  });
});
