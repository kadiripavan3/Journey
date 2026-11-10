import { render, screen, userEvent } from '@testing-library/react-native';
import { useVideoPlayer } from 'expo-video';

import { ClipBadge, ClipPlayer } from '../ClipPlayer';

jest.mock('expo-video', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { useVideoPlayer: jest.fn(() => ({ play: jest.fn() })), VideoView: () => <View testID="video" /> };
});

const player = jest.mocked(useVideoPlayer);
const clip = { url: 'https://example.test/still.jpg', playbackUrl: 'https://example.test/clip.m3u8', durationSeconds: 42, status: 'ready' } as const;

beforeEach(() => jest.clearAllMocks());

describe('ClipPlayer', () => {
  it('shows the still frame and its length, and loads nothing until the person taps play', async () => {
    await render(<ClipPlayer clip={clip} />);
    expect(screen.getByText('Tap to play · 0:42')).toBeOnTheScreen();
    expect(player).not.toHaveBeenCalled();
    expect(screen.queryByTestId('video')).not.toBeOnTheScreen();

    await userEvent.setup().press(screen.getByRole('button', { name: 'Play the clip. 0:42' }));
    expect(screen.getByTestId('video')).toBeOnTheScreen();
    expect(player).toHaveBeenCalledWith('https://example.test/clip.m3u8', expect.any(Function));
  });

  it('starts playing when tapped, without looping', async () => {
    await render(<ClipPlayer clip={clip} />);
    await userEvent.setup().press(screen.getByRole('button', { name: /^Play the clip/ }));
    const created = { loop: true, play: jest.fn() };
    const setup = player.mock.calls[0]![1] as unknown as (made: typeof created) => void;
    setup(created);
    expect(created.loop).toBe(false);
    expect(created.play).toHaveBeenCalledTimes(1);
  });

  it('tells its author when a clip is still being made ready, or could not be used', async () => {
    const view = await render(<ClipPlayer clip={{ ...clip, status: 'processing', playbackUrl: null }} />);
    expect(screen.getByText('Your clip is getting ready. Others see it once it is.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'This clip is still getting ready' })).toBeDisabled();

    await view.rerender(<ClipPlayer clip={{ ...clip, status: 'failed', playbackUrl: null }} />);
    expect(screen.getByText(/This clip couldn't be used/)).toBeOnTheScreen();
  });
});

describe('ClipBadge', () => {
  it('shows the length, or just says it is a clip', async () => {
    const view = await render(<ClipBadge seconds={75} />);
    expect(screen.getByText('1:15')).toBeOnTheScreen();
    await view.rerender(<ClipBadge seconds={null} />);
    expect(screen.getByText('Clip')).toBeOnTheScreen();
  });
});
