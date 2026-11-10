import { render, screen, userEvent } from '@testing-library/react-native';
import * as Clipboard from 'expo-clipboard';

import type { EntryResponse, JourneyResponse, PersonResponse } from '@/api/generated/journey';
import { onPhone } from '@/test/phone';
import { CheckRow } from '@/ui/CheckRow';
import { LinkBox } from '@/ui/LinkBox';

import { InvitationView } from '../journeys/InvitationView';
import { heldCount, HeldCommentNote, HeldNote, HeldVeil } from '../safety/Held';
import { ShareSheet } from '../sharing/ShareSheet';

jest.mock('expo-clipboard', () => ({ setStringAsync: jest.fn(() => Promise.resolve(true)) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), useIsFocused: () => true }));

const photo = (id: string, held: boolean) => ({ id, kind: 'photo', url: `https://example.com/${id}.jpg`, thumbUrl: null, width: 4, height: 3, durationSeconds: null, held });
const entry = (media: ReturnType<typeof photo>[]) => ({ id: 'e1', journeyId: 'j1', journeyTitle: 'Iceland ring road', label: 'Day 8', title: 'Black sand', body: '', media }) as unknown as EntryResponse;

describe('a link to copy', () => {
  it('shows the address without https and says Copied once it is on the clipboard', async () => {
    await render(<LinkBox url="https://journey.app/i/k7m2-x9qd-p4wn-3hbs" />);
    expect(screen.getByText('journey.app/i/k7m2-x9qd-p4wn-3hbs')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Copy' }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://journey.app/i/k7m2-x9qd-p4wn-3hbs');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeOnTheScreen();
  });
});

describe('the box to tick at sign-up', () => {
  it('is a checkbox that says what it stands for and flips when pressed', async () => {
    const change = jest.fn();
    await render(<CheckRow label="I'm 13 or older" checked={false} onChange={change} />);
    const box = screen.getByRole('checkbox', { name: "I'm 13 or older" });
    expect(box).not.toBeChecked();
    await userEvent.setup().press(box);
    expect(change).toHaveBeenCalledWith(true);
  });
});

describe('the share sheet', () => {
  const link = { url: 'https://journey.app/e/41aa', title: 'Black sand and big waves', line: 'Day 8 of Iceland ring road, by Nora Lind', text: 'Black sand · Iceland ring road' };

  it('shows the link as others will see it, with the places to send it', async () => {
    await render(onPhone(<ShareSheet visible onClose={() => {}} heading="Share your entry" link={link} />));
    expect(screen.getByRole('header', { name: 'Share your entry' })).toBeOnTheScreen();
    expect(screen.getByText('Black sand and big waves')).toBeOnTheScreen();
    expect(screen.getByText('journey.app')).toBeOnTheScreen();
    expect(screen.getByText('journey.app/e/41aa')).toBeOnTheScreen();
    for (const way of ['Messages', 'Mail', 'Copy link', 'More']) expect(screen.getByRole('button', { name: way })).toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Copy link' }));
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('https://journey.app/e/41aa');
    expect(await screen.findByRole('button', { name: 'Copied' })).toBeOnTheScreen();
  });

  it('says why when there is no link to share', async () => {
    await render(onPhone(<ShareSheet visible onClose={() => {}} heading="Share your entry" link={undefined} problem="This entry is in a private journey, so there is no link to share." />));
    expect(screen.getByText('This entry is in a private journey, so there is no link to share.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Copy link' })).not.toBeOnTheScreen();
  });
});

describe('a photo held for review', () => {
  it('is counted, veiled and explained to the person who posted it', async () => {
    const mine = entry([photo('a', false), photo('b', true)]);
    expect(heldCount(mine)).toBe(1);
    await render(
      <>
        <HeldVeil />
        <HeldNote entry={mine} />
      </>,
    );
    expect(screen.getByText('Hidden for now')).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'One photo is being reviewed. See what this means' }));
    expect(mockPush).toHaveBeenCalledWith('/review/e1');
  });

  it('says nothing when no photo is held', async () => {
    await render(<HeldNote entry={entry([photo('a', false)])} />);
    expect(screen.queryByText(/being reviewed/)).not.toBeOnTheScreen();
  });

  it('tells the author of a held comment that only they can see it', async () => {
    await render(<HeldCommentNote />);
    expect(screen.getByText('Only you can see this for now. A person will read it soon.')).toBeOnTheScreen();
  });
});

describe('an invitation', () => {
  const journey = { id: 'j1', title: 'Faroe ferry', visibility: 'public', followerCount: 58, coverUrl: null } as unknown as JourneyResponse;
  const invitedBy = { id: 'p1', username: 'alex', displayName: 'Alex Strand', avatarUrl: null } as PersonResponse;
  const actions = { onJoin: jest.fn(), onDecline: jest.fn(), onClose: jest.fn(), joining: false, loading: false, gone: 'This invitation link has been used or has run out.' };

  it('says who asked, what joining means, and waits for a yes', async () => {
    await render(onPhone(<InvitationView {...actions} invitation={{ journey, invitedBy }} />));
    expect(screen.getByText('Alex Strand invited you')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Add to Faroe ferry?' })).toBeOnTheScreen();
    expect(screen.getByText("It's public, and 58 people follow it")).toBeOnTheScreen();
    await userEvent.setup().press(screen.getByRole('button', { name: 'Join the journey' }));
    expect(actions.onJoin).toHaveBeenCalledTimes(1);
  });

  it('says so when the link has been used', async () => {
    await render(onPhone(<InvitationView {...actions} invitation={null} />));
    expect(screen.getByText('This invitation link has been used or has run out.')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Join the journey' })).not.toBeOnTheScreen();
  });
});
