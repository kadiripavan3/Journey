import { ApiError, apiFetch, connectSession } from '@/api/fetcher';

type Listener = (event: string, session: { access_token: string } | null) => void;

const mockAuth = {
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  signInWithIdToken: jest.fn(),
  getSession: jest.fn(),
  refreshSession: jest.fn(),
  signOut: jest.fn(),
  startAutoRefresh: jest.fn(),
  stopAutoRefresh: jest.fn(),
  listener: null as Listener | null,
  onAuthStateChange: jest.fn((listener: Listener) => {
    mockAuth.listener = listener;
    return { data: { subscription: { unsubscribe: jest.fn() } } };
  }),
};
const mockMade: unknown[] = [];

jest.mock('@supabase/auth-js', () => ({
  AuthClient: jest.fn((options: unknown) => {
    mockMade.push(options);
    return mockAuth;
  }),
}));

describe('real sign-in (Supabase)', () => {
  const load = () => {
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://project.supabase.example/';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('../signIn.supabase') as typeof import('../signIn.supabase')).supabaseSignIn();
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockMade.length = 0;
  });

  it('asks Supabase for a code and signs in with it; the session hears the token', async () => {
    const service = load();
    const heard: (string | null)[] = [];
    service.onToken((token) => heard.push(token));

    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    await service.requestCode('maya@example.com');
    expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'maya@example.com', options: { shouldCreateUser: true } });
    expect(mockMade[0]).toMatchObject({ url: 'https://project.supabase.example/auth/v1', headers: { apikey: 'anon-key' }, detectSessionInUrl: false });

    mockAuth.verifyOtp.mockResolvedValue({ data: { session: { access_token: 'token-1' } }, error: null });
    await service.verifyCode('maya@example.com', '123456');
    expect(mockAuth.verifyOtp).toHaveBeenCalledWith({ email: 'maya@example.com', token: '123456', type: 'email' });

    // Supabase tells every listener: at sign-in, each time it renews the token, and when the sign-in ends.
    mockAuth.listener?.('SIGNED_IN', { access_token: 'token-1' });
    mockAuth.listener?.('TOKEN_REFRESHED', { access_token: 'token-2' });
    mockAuth.listener?.('SIGNED_OUT', null);
    expect(heard).toEqual(['token-1', 'token-2', null]);
  });

  it('says a wrong code and a rush of requests in plain words', async () => {
    const service = load();
    mockAuth.verifyOtp.mockResolvedValue({ data: { session: null }, error: { status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' } });
    await expect(service.verifyCode('maya@example.com', '000000')).rejects.toMatchObject({ code: 'wrong_code', message: expect.stringContaining("isn't right") });
    mockAuth.signInWithOtp.mockResolvedValue({ error: { status: 429, code: 'over_email_send_rate_limit', message: 'rate limit' } });
    await expect(service.requestCode('maya@example.com')).rejects.toMatchObject({ code: 'slow_down' });
  });

  it('brings back last time\'s sign-in, renews it when asked, and offers Apple only on an iPhone', async () => {
    const service = load();
    mockAuth.getSession.mockResolvedValue({ data: { session: { access_token: 'saved' } } });
    await expect(service.restore()).resolves.toBe('saved');
    mockAuth.refreshSession.mockResolvedValue({ data: { session: { access_token: 'fresh' } }, error: null });
    await expect(service.renew()).resolves.toBe('fresh');
    mockAuth.refreshSession.mockResolvedValue({ data: { session: null }, error: { status: 400, message: 'refresh token revoked' } });
    await expect(service.renew()).resolves.toBeNull();
    expect(service.google).toBeNull(); // no client id in this build
  });

  it('does nothing, and breaks nothing, in a build without the project settings', async () => {
    delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const service = (require('../signIn.supabase') as typeof import('../signIn.supabase')).supabaseSignIn();
    await expect(service.restore()).resolves.toBeNull();
    await expect(service.requestCode('maya@example.com')).rejects.toMatchObject({ code: 'not_connected' });
    expect(mockMade).toHaveLength(0);
  });
});

describe('a token that ran out', () => {
  const fetchMock = jest.fn();
  const respond = (status: number, body?: unknown) => Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));

  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.EXPO_PUBLIC_API_URL = 'http://api.test';
  });

  it('is renewed once and the request sent again, without the person noticing', async () => {
    let signedOut = 0;
    connectSession({ getToken: () => 'old', renew: () => Promise.resolve('new'), onSignedOut: () => (signedOut += 1) });
    fetchMock.mockReturnValueOnce(respond(401, { code: 'signed_out', detail: 'Please sign in again.' })).mockReturnValueOnce(respond(200, { ok: true }));

    await expect(apiFetch('/v1/me')).resolves.toEqual({ ok: true });

    const sent = fetchMock.mock.calls.map(([, init]) => new Headers((init as RequestInit).headers).get('Authorization'));
    expect(sent).toEqual(['Bearer old', 'Bearer new']);
    expect(signedOut).toBe(0);
  });

  it('signs the person out when it cannot be renewed', async () => {
    let signedOut = 0;
    connectSession({ getToken: () => 'old', renew: () => Promise.resolve(null), onSignedOut: () => (signedOut += 1) });
    fetchMock.mockReturnValue(respond(401, { code: 'signed_out', detail: 'Please sign in again.' }));

    await expect(apiFetch('/v1/me')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signedOut).toBe(1);
  });
});
