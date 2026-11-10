import type { MapPinResponse } from '@/api/generated/journey';

/** One spot on the map: the entries that share it, in story order. */
export type Stop = { key: string; lat: number; lng: number; pins: MapPinResponse[] };

/**
 * Entries at the same point share one marker: other people see a city-level point, so a week in one town
 * is one spot. Stops come in the order the story first reaches them.
 */
export function stopsOf(pins: MapPinResponse[]): Stop[] {
  const stops = new Map<string, Stop>();
  for (const pin of pins) {
    const key = `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`;
    const stop = stops.get(key);
    if (stop) stop.pins.push(pin);
    else stops.set(key, { key, lat: pin.lat, lng: pin.lng, pins: [pin] });
  }
  return [...stops.values()];
}

/** The words on a stop's pill: "Day 14", or "Day 3 +2" when more entries share the spot. */
export function stopLabel(stop: Stop): string {
  const first = stop.pins[0]?.label ?? '';
  return stop.pins.length > 1 ? `${first} +${stop.pins.length - 1}` : first;
}

/** "Day 14 · Hoi An": a pin's label and its place. */
export function pinEyebrow(pin: Pick<MapPinResponse, 'label' | 'placeName'>): string {
  return pin.placeName ? `${pin.label} · ${pin.placeName}` : pin.label;
}

/** The part of the world that holds every pin, with some room around it: the map's first view. Null without pins. */
export function regionOf(pins: Pick<MapPinResponse, 'lat' | 'lng'>[]): { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number } | null {
  if (pins.length === 0) return null;
  const lats = pins.map((pin) => pin.lat);
  const lngs = pins.map((pin) => pin.lng);
  const south = Math.min(...lats);
  const north = Math.max(...lats);
  const west = Math.min(...lngs);
  const east = Math.max(...lngs);
  return {
    latitude: (south + north) / 2,
    longitude: (west + east) / 2,
    // One pin, or pins in one town, still shows the town around it.
    latitudeDelta: Math.max((north - south) * 1.5, 0.2),
    longitudeDelta: Math.max((east - west) * 1.5, 0.2),
  };
}
