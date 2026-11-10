import type { ConfigContext, ExpoConfig } from 'expo/config';

import appJson from '../../app.json';
import appConfig from '../../app.config';

const SETTINGS = ['EXPO_PUBLIC_LINK_HOST', 'GOOGLE_MAPS_ANDROID_KEY', 'GOOGLE_SERVICES_JSON', 'SENTRY_ORG', 'SENTRY_PROJECT', 'SENTRY_AUTH_TOKEN'];
const base = appJson.expo as unknown as ExpoConfig;

/** The app's configuration as a build with these settings gets it. */
function built(settings: Record<string, string>): ExpoConfig {
  const before = { ...process.env };
  for (const name of SETTINGS) delete process.env[name];
  Object.assign(process.env, settings);
  try {
    return appConfig({ config: base } as ConfigContext);
  } finally {
    process.env = before;
  }
}
const pluginNames = (config: ExpoConfig) => (config.plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));

describe("the app's configuration", () => {
  it('is exactly app.json without build settings: nothing changes for Expo Go, the browser or a plain build', () => {
    const config = built({});
    expect({ ...config, extra: undefined }).toEqual({ ...base, extra: undefined });
    expect(config.extra).toEqual({ androidMaps: false });
    expect(pluginNames(config)).not.toContain('@sentry/react-native/expo');
    expect(config.ios?.associatedDomains).toBeUndefined();
    expect(config.android?.intentFilters).toBeUndefined();
    expect(config.android?.googleServicesFile).toBeUndefined();
    // No key of any kind is kept in the repository.
    expect(JSON.stringify(appJson)).not.toMatch(/apiKey|AIza|sntrys_|phc_/);
    // The app only uses the phone's own encryption (https), which the App Store asks about with every upload.
    expect(config.ios?.config?.usesNonExemptEncryption).toBe(false);
  });

  it('claims the address shared links come from, so they open the app: the four shared pages and nothing else', () => {
    const config = built({ EXPO_PUBLIC_LINK_HOST: 'https://Go.Example.com/' });
    expect(config.ios?.associatedDomains).toEqual(['applinks:go.example.com']);
    expect(config.android?.intentFilters).toEqual([
      {
        action: 'VIEW',
        autoVerify: true,
        category: ['BROWSABLE', 'DEFAULT'],
        data: ['/j/', '/e/', '/u/', '/i/'].map((pathPrefix) => ({ scheme: 'https', host: 'go.example.com', pathPrefix })),
      },
    ]);
  });

  it("takes Android's map key and its notifications file from the build, and tells the app whether the map can be drawn", () => {
    const config = built({ GOOGLE_MAPS_ANDROID_KEY: 'a-key-from-the-build', GOOGLE_SERVICES_JSON: '/eas/secrets/google-services.json' });
    expect(config.android?.config?.googleMaps?.apiKey).toBe('a-key-from-the-build');
    expect(config.android?.googleServicesFile).toBe('/eas/secrets/google-services.json');
    expect(config.extra?.androidMaps).toBe(true);
    expect(config.android?.package).toBe(base.android?.package); // the rest of app.json stays
  });

  it('adds the upload of source maps to Sentry only when all three of its settings are there, and never writes the token down', () => {
    expect(pluginNames(built({ SENTRY_ORG: 'journey', SENTRY_PROJECT: 'app' }))).not.toContain('@sentry/react-native/expo');
    const config = built({ SENTRY_ORG: 'journey', SENTRY_PROJECT: 'app', SENTRY_AUTH_TOKEN: 'sntrys_secret' });
    expect(config.plugins?.at(-1)).toEqual(['@sentry/react-native/expo', { organization: 'journey', project: 'app' }]);
    expect(JSON.stringify(config)).not.toContain('sntrys_secret');
  });
});
