import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, userEvent, waitFor } from '@testing-library/react-native';

import { saveProfile } from '@/api/generated/journey';
import { uploadPhoto } from '@/api/upload';
import CreateProfile from '@/app/(onboarding)/index';
import { pickSquarePhoto } from '@/features/media/pick';
import { onPhone } from '@/test/phone';

const mockPush = jest.fn();
const mockProfileSaved = jest.fn((_profile: unknown) => Promise.resolve());
const mockSuggestedName = jest.fn<Promise<string | null>, []>();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('@/api/cache', () => ({ useCache: () => ({ profileSaved: mockProfileSaved }) }));
jest.mock('@/api/upload', () => ({ uploadPhoto: jest.fn() }));
jest.mock('@/features/media/pick', () => ({ pickSquarePhoto: jest.fn() }));
jest.mock('@/auth/session', () => ({ useSession: () => ({ status: 'signedIn', signOut: jest.fn() }) }));
jest.mock('@/auth/onboarding', () => ({ useOnboarding: () => ({ begin: jest.fn() }) }));
jest.mock('@/auth/signIn', () => ({ signInService: { suggestedName: () => mockSuggestedName() } }));
jest.mock('@/lib/useDebounced', () => ({ useDebounced: (value: string) => value }));
jest.mock('@/api/generated/journey', () => ({
  saveProfile: jest.fn(),
  useGetMe: () => ({ data: { id: 'me', email: 'maya@example.com', profile: null } }),
  useCheckUsername: (username: string) => ({ data: username.length >= 3 ? { username, available: true } : undefined }),
}));

const saved = jest.mocked(saveProfile);
const client = new QueryClient({ defaultOptions: { queries: { gcTime: Infinity, retry: false }, mutations: { gcTime: Infinity } } });
const page = () => onPhone(<QueryClientProvider client={client}><CreateProfile /></QueryClientProvider>);

describe('2.1 Create your profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSuggestedName.mockResolvedValue(null);
    saved.mockResolvedValue({ id: 'p1', username: 'maya', displayName: 'Maya Okafor', bio: '', link: null, avatarUrl: null, interests: [] });
  });

  it('offers the name the sign-in already knows instead of asking for it again', async () => {
    mockSuggestedName.mockResolvedValue('Maya Okafor'); // what Apple handed over, once
    await render(page());
    await waitFor(() => expect(screen.getByLabelText('Name').props.value).toBe('Maya Okafor'));
  });

  it('takes a photo with the profile: it goes up first and the profile is saved with it, with the confirmation of age', async () => {
    jest.mocked(pickSquarePhoto).mockResolvedValue({ uri: 'file:///picked.jpg', width: 800, height: 800 });
    jest.mocked(uploadPhoto).mockResolvedValue('media-7');
    await render(page());
    const user = userEvent.setup();

    await user.press(screen.getByRole('button', { name: 'Add a photo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Change your photo' })).toBeOnTheScreen());
    await user.type(screen.getByLabelText('Name'), 'Maya Okafor');
    await user.type(screen.getByLabelText('Username'), 'maya');
    await user.press(screen.getByRole('checkbox', { name: "I'm 13 or older" }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/interests'));
    expect(uploadPhoto).toHaveBeenCalledWith({ uri: 'file:///picked.jpg', width: 800, height: 800 });
    expect(saved).toHaveBeenCalledWith({ displayName: 'Maya Okafor', username: 'maya', bio: '', avatarMediaId: 'media-7', ageConfirmed: true });
    // The new profile is told to the data layer by name; the screen invalidates nothing itself.
    expect(mockProfileSaved).toHaveBeenCalledWith(expect.objectContaining({ username: 'maya' }));
  });

  it('says so above the button when the photos cannot be opened, and goes on without a photo', async () => {
    jest.mocked(pickSquarePhoto).mockRejectedValue(new Error('no access'));
    await render(page());
    const user = userEvent.setup();
    await user.press(screen.getByRole('button', { name: 'Add a photo' }));
    expect(await screen.findByText(/couldn't open your photos/)).toBeOnTheScreen();

    await user.type(screen.getByLabelText('Name'), 'Maya');
    await user.type(screen.getByLabelText('Username'), 'maya');
    await user.press(screen.getByRole('checkbox', { name: "I'm 13 or older" }));
    await user.press(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(saved).toHaveBeenCalledWith(expect.objectContaining({ avatarMediaId: undefined })));
    expect(uploadPhoto).not.toHaveBeenCalled();
  });
});
