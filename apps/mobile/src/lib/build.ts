import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

/**
 * What this build of the app was given, for the parts that need something from outside (`app.config.ts`).
 */

/**
 * Whether this build can draw a real map. An iPhone always can (Apple's maps need nothing). Android draws
 * Google's map, which needs a key in the build (the build setting `GOOGLE_MAPS_ANDROID_KEY`); without one,
 * asking for the map would stop the app, so the journey's stops are shown as a list instead, as in the
 * browser. Expo Go brings a key of its own.
 */
export const mapsAvailable: boolean =
  Platform.OS !== 'android' || Constants.executionEnvironment === ExecutionEnvironment.StoreClient || Constants.expoConfig?.extra?.androidMaps === true;

/**
 * The address shared links are served from when they can open the app ("go.example.com"), from the build
 * setting `EXPO_PUBLIC_LINK_HOST`; null in a build that claims no address.
 */
export const linkHost: string | null =
  (process.env.EXPO_PUBLIC_LINK_HOST ?? '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .toLowerCase() || null;
