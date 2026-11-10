import { removeFile } from '@/api/transfer';
import { uploadClip } from '@/api/upload';

import { sendClip } from '../sendClip';

const mockCompress = jest.fn();
jest.mock('react-native-compressor', () => ({ Video: { compress: (...args: unknown[]) => mockCompress(...args) } }));
jest.mock('@/api/upload', () => ({ uploadClip: jest.fn() }));
jest.mock('@/api/transfer', () => ({ removeFile: jest.fn() }));

const upload = jest.mocked(uploadClip);
const removed = jest.mocked(removeFile);

describe('sending a clip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    upload.mockResolvedValue('media-1');
  });

  it('makes it smaller first, says how far the whole job has come, and removes the smaller copy once it is up', async () => {
    mockCompress.mockImplementation(async (_uri: string, _options: unknown, onProgress: (part: number) => void) => {
      onProgress(0.5);
      onProgress(1);
      return 'file:///cache/smaller.mp4';
    });
    upload.mockImplementation(async (_clip, onProgress) => {
      onProgress?.(0.5);
      onProgress?.(1);
      return 'media-1';
    });
    const heard: string[] = [];

    await expect(sendClip({ uri: 'file:///drafts/c1/v.mov', durationSeconds: 12, mimeType: 'video/quicktime' }, (fraction, preparing) => heard.push(`${preparing ? 'smaller' : 'up'} ${fraction.toFixed(2)}`))).resolves.toBe('media-1');

    // Making it smaller is the first third or so; the upload is the rest.
    expect(heard).toEqual(['smaller 0.15', 'smaller 0.30', 'up 0.65', 'up 1.00']);
    // The smaller file is a new file of its own type.
    expect(upload).toHaveBeenCalledWith({ uri: 'file:///cache/smaller.mp4', durationSeconds: 12, mimeType: undefined }, expect.any(Function));
    expect(removed).toHaveBeenCalledWith('file:///cache/smaller.mp4');
    expect(removed).not.toHaveBeenCalledWith('file:///drafts/c1/v.mov');
  });

  it('removes the smaller copy when the upload fails too, and never the clip itself', async () => {
    mockCompress.mockResolvedValue('file:///cache/smaller.mp4');
    upload.mockRejectedValue(new Error('no connection'));
    await expect(sendClip({ uri: 'file:///drafts/c1/v.mov' })).rejects.toThrow('no connection');
    expect(removed.mock.calls).toEqual([['file:///cache/smaller.mp4']]);
  });

  it('sends one clip as it is when making it smaller fails, and still tries with the next', async () => {
    mockCompress.mockRejectedValueOnce(new Error('this one could not be read')).mockResolvedValueOnce('file:///cache/next-smaller.mp4');

    await sendClip({ uri: 'file:///drafts/c1/odd.mov', mimeType: 'video/quicktime' });
    expect(upload).toHaveBeenLastCalledWith({ uri: 'file:///drafts/c1/odd.mov', durationSeconds: undefined, mimeType: 'video/quicktime' }, expect.any(Function));
    expect(removed).not.toHaveBeenCalled();

    await sendClip({ uri: 'file:///drafts/c1/next.mov' });
    expect(mockCompress).toHaveBeenCalledTimes(2);
    expect(upload).toHaveBeenLastCalledWith(expect.objectContaining({ uri: 'file:///cache/next-smaller.mp4' }), expect.any(Function));
  });
});
