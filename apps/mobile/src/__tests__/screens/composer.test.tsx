import { act, render, screen, userEvent } from '@testing-library/react-native';

import { ApiError } from '@/api/fetcher';
import Composer from '@/app/(app)/journey/[id]/add';
import type { Draft } from '@/features/drafts/types';
import { onPhone } from '@/test/phone';
import { entry, failed, journey, loaded, pending } from '@/test/samples';

let mockParams: Record<string, string> = { id: 'j1' };
/** What the navigator would call when Android's back button (or a swipe) tries to leave the screen. */
let mockGuard: { on: boolean; asked: (how: { repeat: () => void }) => void } = { on: false, asked: () => {} };
const mockLeave = jest.fn();
const mockDismissTo = jest.fn();
const mockJourney = jest.fn();
const mockEntry = jest.fn();
const mockOutbox = { drafts: [] as Draft[], online: true, save: jest.fn(() => Promise.resolve()), release: jest.fn(), discard: jest.fn(() => Promise.resolve()) };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ replace: jest.fn(), dismissTo: mockDismissTo, canDismiss: () => true, dismissAll: jest.fn(), navigate: jest.fn() }),
  usePreventRemove: (on: boolean, asked: (how: { repeat: () => void }) => void) => {
    mockGuard = { on, asked };
    return jest.fn();
  },
}));
jest.mock('@/features/navigation/useLeave', () => ({ useLeave: () => mockLeave }));
jest.mock('@/api/cache', () => ({ useCache: () => ({ entrySaved: jest.fn(() => Promise.resolve()) }) }));
jest.mock('@/api/upload', () => ({ uploadPhoto: jest.fn() }));
jest.mock('@/api/generated/journey', () => ({ changeEntry: jest.fn(() => Promise.resolve()), useGetJourney: () => mockJourney(), useGetEntry: () => mockEntry() }));
jest.mock('@/features/drafts/outbox', () => ({ useOutbox: () => mockOutbox }));
jest.mock('@/features/journeys/catalog', () => ({ useCatalog: () => ({ clips: false, template: () => ({ prompts: [] }) }) }));
jest.mock('@/features/media/pick', () => ({ MAX_PHOTOS: 10, MAX_CLIPS: 3, pickMedia: jest.fn() }));
jest.mock('@/features/media/sendClip', () => ({ sendClip: jest.fn() }));
jest.mock('@/features/media/ClipPlayer', () => ({ ClipBadge: () => null }));
jest.mock('@/features/places/lookup', () => ({ placeAt: jest.fn() }));
jest.mock('@/features/places/PlaceSheet', () => ({ PlaceSheet: () => null }));
jest.mock('expo-video', () => ({ useVideoPlayer: jest.fn(), VideoView: () => null }));

const stored = (over: Partial<Draft> = {}): Draft => ({
  clientId: 'd1',
  owner: 'p-nora',
  journeyId: 'j1',
  journey: { title: 'Iceland ring road', startDate: '2026-04-01', labelStyle: 'day', template: 'trip', coverThumbUrl: null },
  title: 'Skógafoss in the rain',
  body: '',
  day: '2026-04-07',
  dayLabel: 'Day 7',
  place: null,
  milestone: false,
  media: [],
  state: 'draft',
  savedAt: '2026-04-07T10:00:00.000Z',
  ...over,
});

describe('the composer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = { id: 'j1' };
    mockOutbox.drafts = [];
    mockJourney.mockReturnValue(loaded(journey({ viewer: { isOwner: true, isMember: false, isFollowing: false, canAddEntry: true, lastReadAt: null } })));
    mockEntry.mockReturnValue(pending());
  });

  it('opens empty and leaves without a question when nothing was written', async () => {
    await render(onPhone(<Composer />));
    expect(screen.getByRole('header', { name: 'New entry' })).toBeOnTheScreen();
    expect(mockGuard.on).toBe(false);
    await userEvent.setup().press(screen.getByRole('button', { name: 'Close' }));
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('asks "Save this for later?" on the X once something is written, and saves a draft', async () => {
    const user = userEvent.setup();
    await render(onPhone(<Composer />));
    await user.type(screen.getByLabelText('Title, optional'), 'Black sand');
    expect(mockGuard.on).toBe(true);
    await user.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('header', { name: 'Save this for later?' })).toBeOnTheScreen();
    expect(mockLeave).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Save as a draft' }));
    expect(mockOutbox.save).toHaveBeenCalledWith(expect.objectContaining({ title: 'Black sand', journeyId: 'j1' }), 'draft');
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it("asks the same question when Android's back button leaves, and carries on after the answer", async () => {
    const user = userEvent.setup();
    await render(onPhone(<Composer />));
    await user.type(screen.getByLabelText('What happened'), 'Low tide.');
    const repeat = jest.fn();
    await act(async () => mockGuard.asked({ repeat }));
    expect(screen.getByRole('header', { name: 'Save this for later?' })).toBeOnTheScreen();
    expect(repeat).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Discard' }));
    expect(repeat).toHaveBeenCalledTimes(1);
    expect(mockOutbox.save).not.toHaveBeenCalled();
  });

  it('"Keep writing" stays, with what was written', async () => {
    const user = userEvent.setup();
    await render(onPhone(<Composer />));
    await user.type(screen.getByLabelText('Title, optional'), 'Black sand');
    await user.press(screen.getByRole('button', { name: 'Close' }));
    await user.press(screen.getByRole('button', { name: 'Keep writing' }));
    expect(mockLeave).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Title, optional')).toHaveDisplayValue('Black sand');
  });

  it('puts an entry that was waiting to go up back in line when it is only opened and closed', async () => {
    mockParams = { id: 'j1', draft: 'd1', was: 'queued' };
    mockOutbox.drafts = [stored()];
    await render(onPhone(<Composer />));
    expect(screen.getByRole('header', { name: 'Draft' })).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Close' }));
    expect(mockOutbox.release).toHaveBeenCalledWith('d1', 'queued');
    expect(mockLeave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('header', { name: 'Keep this draft?' })).not.toBeOnTheScreen();
  });

  it("puts it back in line on Android's back button too", async () => {
    mockParams = { id: 'j1', draft: 'd1', was: 'failed' };
    mockOutbox.drafts = [stored()];
    await render(onPhone(<Composer />));
    expect(mockGuard.on).toBe(true);
    const repeat = jest.fn();
    await act(async () => mockGuard.asked({ repeat }));
    expect(mockOutbox.release).toHaveBeenCalledWith('d1', 'failed');
    expect(repeat).toHaveBeenCalledTimes(1);
  });

  it('leaves a real draft a draft, and asks once it was changed', async () => {
    mockParams = { id: 'j1', draft: 'd1', was: 'draft' };
    mockOutbox.drafts = [stored()];
    const user = userEvent.setup();
    await render(onPhone(<Composer />));
    expect(mockGuard.on).toBe(false);
    await user.type(screen.getByLabelText('What happened'), 'Soaked.');
    await user.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('header', { name: 'Keep this draft?' })).toBeOnTheScreen();
    expect(mockOutbox.release).not.toHaveBeenCalled();
  });

  it('asks before throwing away changes to a posted entry', async () => {
    mockParams = { id: 'j1', entry: 'e1' };
    mockEntry.mockReturnValue(loaded(entry()));
    const user = userEvent.setup();
    await render(onPhone(<Composer />));
    expect(screen.getByRole('header', { name: 'Edit entry' })).toBeOnTheScreen();
    expect(mockGuard.on).toBe(false);

    await user.type(screen.getByLabelText('Title, optional'), '!');
    await user.press(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('header', { name: 'Discard your changes?' })).toBeOnTheScreen();
    await user.press(screen.getByRole('button', { name: 'Keep editing' }));
    expect(mockLeave).not.toHaveBeenCalled();

    await user.press(screen.getByRole('button', { name: 'Close' }));
    await user.press(screen.getByRole('button', { name: 'Discard changes' }));
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it('has a way out while it loads, and says so when it is waiting for a connection', async () => {
    mockJourney.mockReturnValue({ ...pending(), isPaused: true });
    await render(onPhone(<Composer />));
    expect(screen.getByText("You're offline")).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Close' }));
    expect(mockLeave).toHaveBeenCalledTimes(1);
  });

  it("offers the way Home, not Try again, when the journey isn't there", async () => {
    mockJourney.mockReturnValue(failed(new ApiError(404, 'not_found', "This journey isn't available.")));
    await render(onPhone(<Composer />));
    expect(screen.getByText("This journey isn't available.")).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeOnTheScreen();
  });
});
