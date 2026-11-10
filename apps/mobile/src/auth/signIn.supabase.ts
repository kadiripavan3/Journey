import { AuthClient, type AuthError, type GoTrueClient, type Session } from '@supabase/auth-js';
import * as Crypto from 'expo-crypto';
import { AppState, Platform } from 'react-native';

import { ApiError } from '@/api/fetcher';

import type { SignInService } from './signIn';
import { sessionStore } from './storage';

/**
 * Real sign-in, with Supabase Auth: a code by email, Apple on an iPhone, and Google once its client ids are
 * set. Supabase keeps the session fresh (it renews the token before it runs out) and this passes each new
 * token on. Needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY (docs/08-connect-services.md).
 */
export function supabaseSignIn(): SignInService {
  const url = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

  let made: GoTrueClient | null = null;
  const client = () => {
    if (!url || !key) throw new ApiError(0, 'not_connected', "Sign-in isn't set up in this build yet.");
    if (!made) {
      made = new AuthClient({
        url: `${url}/auth/v1`,
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        storage: sessionStore,
        storageKey: 'journey.supabase',
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      });
      // On a phone, renewing only makes sense while the app is open.
      if (Platform.OS !== 'web') {
        AppState.addEventListener('change', (state) => void (state === 'active' ? made?.startAutoRefresh() : made?.stopAutoRefresh()));
      }
    }
    return made;
  };

  const signedIn = (result: { data: { session: Session | null }; error: AuthError | null }) => {
    if (result.error) throw problem(result.error);
    if (!result.data.session) throw new ApiError(0, 'sign_in_failed', "That didn't sign you in. Try again.");
  };

  const withApple = async () => {
    const Apple = await import('expo-apple-authentication');
    // Apple gets a fingerprint of a random value and Supabase the value itself, so the answer can't be replayed.
    const nonce = Crypto.randomUUID();
    const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
    let token: string | null;
    try {
      const credential = await Apple.signInAsync({
        requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
        nonce: hashed,
      });
      token = credential.identityToken;
    } catch (error) {
      if (isCode(error, 'ERR_REQUEST_CANCELED')) throw new ApiError(0, 'cancelled', '');
      throw new ApiError(0, 'sign_in_failed', "Apple didn't sign you in. Try again, or use your email.");
    }
    if (!token) throw new ApiError(0, 'sign_in_failed', "Apple didn't sign you in. Try again, or use your email.");
    signedIn(await client().signInWithIdToken({ provider: 'apple', token, nonce }));
  };

  const withGoogle = async () => {
    type GoogleModule = {
      GoogleSignin: {
        configure(options: { webClientId?: string; iosClientId?: string }): void;
        hasPlayServices(): Promise<boolean>;
        signIn(): Promise<{ type: string; data?: { idToken: string | null } }>;
      };
    };
    let google: GoogleModule;
    try {
      // Only in an installed build that includes Google sign-in; Expo Go and the browser don't have it.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      google = require('@react-native-google-signin/google-signin') as GoogleModule;
    } catch {
      throw new ApiError(0, 'not_connected', 'Google sign-in needs the installed app. Use your email for now.');
    }
    let token: string | null | undefined;
    try {
      google.GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
      await google.GoogleSignin.hasPlayServices();
      const answer = await google.GoogleSignin.signIn();
      if (answer.type === 'cancelled') throw new ApiError(0, 'cancelled', '');
      token = answer.data?.idToken;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(0, 'sign_in_failed', "Google didn't sign you in. Try again, or use your email.");
    }
    if (!token) throw new ApiError(0, 'sign_in_failed', "Google didn't sign you in. Try again, or use your email.");
    signedIn(await client().signInWithIdToken({ provider: 'google', token }));
  };

  return {
    async requestCode(email) {
      const { error } = await client().signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw problem(error);
    },
    async verifyCode(email, code) {
      signedIn(await client().verifyOtp({ email, token: code, type: 'email' }));
    },
    apple: Platform.OS === 'ios' ? withApple : null,
    google: googleWebClientId && Platform.OS !== 'web' ? withGoogle : null,
    async restore() {
      if (!url || !key) return null;
      const { data } = await client().getSession(); // renews it first if it had run out
      return data.session?.access_token ?? null;
    },
    async renew() {
      if (!url || !key) return null;
      const { data, error } = await client().refreshSession();
      return error ? null : (data.session?.access_token ?? null);
    },
    onToken(listener) {
      if (!url || !key) return () => {};
      const { data } = client().onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') listener(session?.access_token ?? null);
        if (event === 'SIGNED_OUT') listener(null);
      });
      return () => data.subscription.unsubscribe();
    },
    async signOut() {
      if (!url || !key) return;
      await client().signOut({ scope: 'local' });
    },
  };
}

/** Supabase's reasons, in the app's own words. */
function problem(error: AuthError): ApiError {
  const code = error.code ?? '';
  if (code === 'otp_expired' || code === 'invalid_credentials' || error.status === 403 || error.status === 401) {
    return new ApiError(error.status ?? 401, 'wrong_code', "That code isn't right, or it has run out. Check it or ask for a new one.");
  }
  if (error.status === 429 || code.includes('rate_limit')) {
    return new ApiError(429, 'slow_down', "That's a lot of codes. Wait a minute and try again.");
  }
  if (code === 'validation_failed' || code === 'email_address_invalid') {
    return new ApiError(400, 'invalid_email', "That email doesn't look right.");
  }
  if (!error.status) {
    return new ApiError(0, 'unreachable', "Can't reach Journey right now. Check your connection and try again.");
  }
  return new ApiError(error.status, 'sign_in_failed', "That didn't work. Try again in a moment.");
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === code;
}
