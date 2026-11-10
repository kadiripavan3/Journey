import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { areaName, type FoundPlace, typedName } from './place';

/** The phone can say where it is. (A browser preview can't name the spot, so it doesn't offer this.) */
export const canLocate = true;

/** Thrown when the person said no to location: the sheet explains what still works. */
export class LocationDenied extends Error {}

/**
 * On Android the phone's place search only works once location is allowed. `ask` shows the phone's own
 * question when it hasn't been answered yet; without it nothing pops up.
 */
async function allowed(ask: boolean): Promise<boolean> {
  const now = await Location.getForegroundPermissionsAsync();
  if (now.granted) return true;
  if (!ask || !now.canAskAgain) return false;
  return (await Location.requestForegroundPermissionsAsync()).granted;
}

/** Looking a name up needs permission on Android only. */
const lookupNeedsPermission = Platform.OS === 'android';

/** Places matching what the person typed, found by the phone's own place search. */
export async function searchPlaces(words: string): Promise<FoundPlace[]> {
  const query = words.trim();
  if (query.length < 2) return [];
  if (lookupNeedsPermission && !(await allowed(true))) throw new LocationDenied();
  const points = (await Location.geocodeAsync(query)).slice(0, 4);
  const found: FoundPlace[] = [];
  for (const point of points) {
    const address = (await Location.reverseGeocodeAsync({ latitude: point.latitude, longitude: point.longitude }).catch(() => []))[0];
    const area = areaName(address);
    // First what they typed, as its own name ("Mount Bromo, Indonesia"); then the town it is in.
    if (found.length === 0) found.push({ name: typedName(query, address?.country), lat: point.latitude, lng: point.longitude, note: area ? `Near ${area}` : undefined });
    if (area && !found.some((place) => place.name.toLowerCase() === area.toLowerCase())) found.push({ name: area, lat: point.latitude, lng: point.longitude });
  }
  return found.slice(0, 6);
}

/** Where the phone is now, named by its town. Asks for location the first time. Null when the phone can't tell. */
export async function placeHere(): Promise<FoundPlace | null> {
  if (!(await allowed(true))) throw new LocationDenied();
  const position = (await Location.getLastKnownPositionAsync({ maxAge: 120_000 })) ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return named(position.coords.latitude, position.coords.longitude);
}

/** The town at a spot on the map, such as where a photo was taken. Never asks for anything: null when it can't be looked up. */
export async function placeAt(lat: number, lng: number): Promise<FoundPlace | null> {
  if (lookupNeedsPermission && !(await allowed(false))) return null;
  return named(lat, lng).catch(() => null);
}

async function named(lat: number, lng: number): Promise<FoundPlace | null> {
  const address = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }))[0];
  const name = areaName(address);
  return name ? { name, lat, lng } : null;
}
