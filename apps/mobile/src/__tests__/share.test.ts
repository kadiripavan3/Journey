import { Share } from 'react-native';

import { shareLink } from '@/lib/share';

describe('sharing a link', () => {
  it('sends the line as it was given: "on Journey" is said once', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction, activityType: undefined });
    // The API words the line for a profile ("Follow Nora Lind on Journey"); nothing is added to it here.
    await shareLink('Follow Nora Lind on Journey', 'https://journey.app/u/nora');
    const sent = share.mock.calls[0]![0] as { message: string; url?: string };
    expect(sent.message.match(/on Journey/g)).toHaveLength(1);
    expect(`${sent.message} ${sent.url ?? ''}`).toContain('https://journey.app/u/nora');
    share.mockRestore();
  });
});
