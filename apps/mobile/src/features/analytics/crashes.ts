import { Platform } from 'react-native';

/**
 * Crash reports, with Sentry. Like analytics, it is switched on by a key (EXPO_PUBLIC_SENTRY_DSN) that only
 * real builds have; without it nothing is loaded. A report says what broke and where in the code. It carries
 * the account's id and nothing a person wrote: no names, no addresses of the pages they looked at, no log lines.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

type Reporter = {
  captureException: (error: unknown) => unknown;
  setUser: (user: { id: string } | null) => unknown;
};

let reporter: Promise<Reporter | null> | null = null;

export function crashReportsOn(): boolean {
  return Boolean(DSN) && Platform.OS !== 'web';
}

/** An API address without the parts that say who or what: "/v1/profiles/maya?tab=followers" becomes "/v1/profiles/…". */
export function withoutDetails(url: unknown): string {
  if (typeof url !== 'string') return '';
  const path = url.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0] ?? '';
  const [version, resource, ...rest] = path.split('/').filter(Boolean);
  if (!version) return '/';
  return `/${[version, resource].filter(Boolean).join('/')}${rest.length > 0 ? '/…' : ''}`;
}

function load(): Promise<Reporter | null> {
  if (!DSN || !crashReportsOn()) return Promise.resolve(null);
  reporter ??= Promise.resolve()
    .then((): Reporter => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- on purpose: loaded here and nowhere else, only with a key
      const Sentry = require('@sentry/react-native') as typeof import('@sentry/react-native');
      Sentry.init({
        dsn: DSN,
        sendDefaultPii: false,
        // Only crashes and errors; no timing of screens or requests.
        tracesSampleRate: 0,
        beforeBreadcrumb: (crumb) => {
          // Log lines can hold anything a person typed, so they stay on the phone.
          if (crumb.category === 'console') return null;
          if ((crumb.category === 'xhr' || crumb.category === 'fetch') && crumb.data) {
            crumb.data = { method: crumb.data.method, status_code: crumb.data.status_code, url: withoutDetails(crumb.data.url) };
          }
          return crumb;
        },
      });
      return Sentry;
    })
    .catch(() => null); // reporting a crash must never cause one
  return reporter;
}

/** Starts watching for crashes, if this build reports them at all. */
export function startCrashReports(): void {
  void load();
}

/** Something broke that the app caught and showed a friendly page for. */
export function reportCrash(error: unknown): void {
  void load().then((sentry) => sentry?.captureException(error));
}

/** Whose phone a crash happened on, by account id only; null after signing out. */
export function crashesBelongTo(accountId: string | null): void {
  void load().then((sentry) => sentry?.setUser(accountId ? { id: accountId } : null));
}
