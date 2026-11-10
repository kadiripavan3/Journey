import type { EntryResponse, SaveEntryRequest } from '@/api/generated/journey';

/**
 * The place on an entry, as the composer holds it: a name, and where it is on the map when known.
 * `exact` is the author's choice to show the very spot; otherwise other people see only the area.
 */
export type PickedPlace = { name: string; lat?: number; lng?: number; exact: boolean };

/** A place the search (or the phone) found: a name to show and where it is. `note` says more about it in a list. */
export type FoundPlace = { name: string; lat: number; lng: number; note?: string };

/** Whether a place has a spot on the map (and not only a name). */
export function hasPoint(place: PickedPlace | null): place is PickedPlace & { lat: number; lng: number } {
  return !!place && place.lat != null && place.lng != null;
}

/** The place, the way the API takes it when an entry is saved. No place clears what was there. */
export function placeFields(place: PickedPlace | null): Pick<SaveEntryRequest, 'placeName' | 'lat' | 'lng' | 'locationPrecision'> {
  const name = place?.name.trim() ?? '';
  if (!place || !name) return { placeName: '' };
  if (!hasPoint(place)) return { placeName: name };
  return { placeName: name, lat: place.lat, lng: place.lng, locationPrecision: place.exact ? 'exact' : 'city' };
}

/** The place an entry has, to start editing from. */
export function placeOf(entry: Pick<EntryResponse, 'placeName' | 'lat' | 'lng' | 'locationPrecision'>): PickedPlace | null {
  if (!entry.placeName) return null;
  if (entry.lat == null || entry.lng == null) return { name: entry.placeName, exact: false };
  return { name: entry.placeName, lat: entry.lat, lng: entry.lng, exact: entry.locationPrecision === 'exact' };
}

/** The pieces a phone gives for an address. */
type Address = { name?: string | null; city?: string | null; district?: string | null; subregion?: string | null; region?: string | null; country?: string | null };

/** "Hoi An, Vietnam": the town and the country, the way a place is named on an entry. Null when the phone knows neither. */
export function areaName(address: Address | null | undefined): string | null {
  if (!address) return null;
  const town = address.city || address.subregion || address.district || address.region;
  const parts = [town, address.country].filter((part): part is string => !!part && part.trim().length > 0);
  return parts.length > 0 ? [...new Set(parts)].join(', ') : null;
}

/** What the person typed, as a place's name: "mount bromo" in Indonesia becomes "Mount Bromo, Indonesia". */
export function typedName(words: string, country?: string | null): string {
  const tidy = words.trim().replace(/\s+/g, ' ');
  const titled = tidy === tidy.toLowerCase() ? tidy.replace(/(^|[\s-])(\p{L})/gu, (_, gap: string, letter: string) => gap + letter.toUpperCase()) : tidy;
  if (!country || titled.toLowerCase().includes(country.toLowerCase())) return titled.slice(0, 80);
  return `${titled}, ${country}`.slice(0, 80);
}
