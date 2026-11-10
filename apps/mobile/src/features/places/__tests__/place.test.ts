import { areaName, hasPoint, placeFields, placeOf, typedName } from '../place';

describe('the place on an entry', () => {
  it('is saved at city level unless the author chose the exact spot', () => {
    expect(placeFields({ name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, exact: false })).toEqual({ placeName: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, locationPrecision: 'city' });
    expect(placeFields({ name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, exact: true })).toEqual({ placeName: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, locationPrecision: 'exact' });
  });

  it('can be a name alone, without a spot on the map', () => {
    expect(placeFields({ name: '  The long way round ', exact: false })).toEqual({ placeName: 'The long way round' });
    expect(hasPoint({ name: 'The long way round', exact: false })).toBe(false);
  });

  it('is cleared when there is none', () => {
    expect(placeFields(null)).toEqual({ placeName: '' });
    expect(placeFields({ name: '   ', lat: 1, lng: 2, exact: true })).toEqual({ placeName: '' });
  });

  it('starts editing from what the entry has', () => {
    expect(placeOf({ placeName: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, locationPrecision: 'exact' })).toEqual({ name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, exact: true });
    expect(placeOf({ placeName: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, locationPrecision: 'city' })).toEqual({ name: 'Hoi An, Vietnam', lat: 15.88, lng: 108.33, exact: false });
    expect(placeOf({ placeName: 'Somewhere', lat: null, lng: null, locationPrecision: 'none' })).toEqual({ name: 'Somewhere', exact: false });
    expect(placeOf({ placeName: null, lat: null, lng: null, locationPrecision: 'none' })).toBeNull();
  });
});

describe('naming a place', () => {
  it('uses the town and the country, never the street', () => {
    expect(areaName({ name: '12 Tran Phu', city: 'Hoi An', region: 'Quang Nam', country: 'Vietnam' })).toBe('Hoi An, Vietnam');
    expect(areaName({ city: null, subregion: 'Probolinggo', country: 'Indonesia' })).toBe('Probolinggo, Indonesia');
    expect(areaName({ country: 'Iceland' })).toBe('Iceland');
    expect(areaName({ city: 'Singapore', country: 'Singapore' })).toBe('Singapore');
  });

  it('is nothing when the phone knows neither', () => {
    expect(areaName(null)).toBeNull();
    expect(areaName({ name: '12 Tran Phu' })).toBeNull();
  });

  it('tidies what the person typed and adds the country it was found in', () => {
    expect(typedName('  mount   bromo ', 'Indonesia')).toBe('Mount Bromo, Indonesia');
    expect(typedName('Skógafoss, Iceland', 'Iceland')).toBe('Skógafoss, Iceland');
    // Capitals the person chose are left alone.
    expect(typedName('the Old Quarter')).toBe('the Old Quarter');
    expect(typedName('ha giang loop')).toBe('Ha Giang Loop');
  });
});
