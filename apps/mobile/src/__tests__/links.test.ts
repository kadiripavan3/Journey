import { rememberLink, screenFor, takeLink } from '@/lib/links';
import { mailLink, shortLink } from '@/lib/share';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));

describe('links that open the app', () => {
  it('turns a shared web address into the screen it is about', () => {
    expect(screenFor('https://journey.app/j/8f2c')).toBe('/journey/8f2c');
    expect(screenFor('https://journey.app/e/41aa?utm=x')).toBe('/entry/41aa');
    expect(screenFor('http://localhost:8080/u/maya.rides')).toBe('/profile/maya.rides');
    expect(screenFor('/i/k7m2-x9qd-p4wn-3hbs')).toBe('/invite/k7m2-x9qd-p4wn-3hbs');
  });

  it('leaves every other link as it came', () => {
    expect(screenFor('journey://entry/41aa')).toBe('journey://entry/41aa');
    expect(screenFor('/settings')).toBe('/settings');
    expect(screenFor('https://journey.app/terms')).toBe('https://journey.app/terms');
    expect(screenFor('https://journey.app/j/')).toBe('https://journey.app/j/');
  });

  it('remembers the screen a link asked for, hands it over once, and forgets it after half an hour', () => {
    expect(takeLink()).toBeNull();
    rememberLink('/invite/k7m2-x9qd', 1_000);
    expect(takeLink(2_000)).toBe('/invite/k7m2-x9qd');
    expect(takeLink(2_000)).toBeNull();

    rememberLink('/invite/k7m2-x9qd', 1_000);
    expect(takeLink(1_000 + 31 * 60 * 1000)).toBeNull();

    // Kept as the screen's own address, so it can be compared with where the app is.
    rememberLink('/entry/41aa?utm=x#top', 1_000);
    expect(takeLink(2_000)).toBe('/entry/41aa');

    // Only screens inside the app are worth coming back to.
    rememberLink('/192.168.1.5:8081/--/', 1_000);
    rememberLink('/terms', 1_000);
    expect(takeLink(2_000)).toBeNull();
  });
});

describe('links people read and send', () => {
  it('shows an address without the parts nobody reads', () => {
    expect(shortLink('https://journey.app/u/maya.rides')).toBe('journey.app/u/maya.rides');
    expect(shortLink('http://localhost:8080/')).toBe('localhost:8080');
  });

  it('writes an email with the subject and the text filled in', () => {
    expect(mailLink('Hoi An · Southeast Asia', 'Look at this\nhttps://journey.app/e/1')).toBe(
      'mailto:?subject=Hoi%20An%20%C2%B7%20Southeast%20Asia&body=Look%20at%20this%0Ahttps%3A%2F%2Fjourney.app%2Fe%2F1',
    );
  });
});
