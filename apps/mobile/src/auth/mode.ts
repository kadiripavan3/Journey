/**
 * How sign-in works in this build. "local" talks to the API's test sign-in (any email, a fixed code);
 * "supabase" will use real sign-in once that service is connected.
 */
export const authMode: 'local' | 'supabase' = process.env.EXPO_PUBLIC_AUTH_MODE === 'supabase' ? 'supabase' : 'local';

/** The code that works in local mode. It matches journey.auth.local.code in the API. */
export const LOCAL_TEST_CODE = '123456';
