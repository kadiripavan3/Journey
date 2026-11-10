import type { MapPinResponse } from '@/api/generated/journey';

import { pinEyebrow, regionOf, stopLabel, stopsOf } from '../stops';

const pin = (entryId: string, label: string, lat: number, lng: number, extra: Partial<MapPinResponse> = {}): MapPinResponse => ({
  entryId,
  label,
  title: `Entry ${entryId}`,
  placeName: 'Somewhere',
  lat,
  lng,
  isMilestone: false,
  happenedOn: '2026-04-01',
  thumbUrl: null,
  ...extra,
});

describe('stops on the map', () => {
  it('puts entries at the same point under one pill, in the order the story first reaches each spot', () => {
    const stops = stopsOf([pin('a', 'Day 1', 21.05, 105.85), pin('b', 'Day 2', 21.05, 105.85), pin('c', 'Day 5', 15.85, 108.35), pin('d', 'Day 9', 21.05, 105.85)]);
    expect(stops).toHaveLength(2);
    expect(stops[0]!.pins.map((p) => p.entryId)).toEqual(['a', 'b', 'd']);
    expect(stops[1]!.pins.map((p) => p.entryId)).toEqual(['c']);
    expect(stopLabel(stops[0]!)).toBe('Day 1 +2');
    expect(stopLabel(stops[1]!)).toBe('Day 5');
  });

  it('keeps exact spots apart, even close ones', () => {
    expect(stopsOf([pin('a', 'Day 1', 15.8801, 108.338), pin('b', 'Day 2', 15.8794, 108.3351)])).toHaveLength(2);
  });

  it('names a pin by its day and place', () => {
    expect(pinEyebrow({ label: 'Day 14', placeName: 'Hoi An' })).toBe('Day 14 · Hoi An');
    expect(pinEyebrow({ label: 'Part 3', placeName: '' })).toBe('Part 3');
  });
});

describe("the map's first view", () => {
  it('holds every pin, with room around them', () => {
    const region = regionOf([pin('a', 'Day 1', 10, 100), pin('b', 'Day 2', 20, 110)])!;
    expect(region.latitude).toBe(15);
    expect(region.longitude).toBe(105);
    expect(region.latitudeDelta).toBe(15);
    expect(region.longitudeDelta).toBe(15);
  });

  it('shows the town around a single pin, and nothing without pins', () => {
    expect(regionOf([pin('a', 'Day 1', 64.15, -21.95)])).toEqual({ latitude: 64.15, longitude: -21.95, latitudeDelta: 0.2, longitudeDelta: 0.2 });
    expect(regionOf([])).toBeNull();
  });
});
