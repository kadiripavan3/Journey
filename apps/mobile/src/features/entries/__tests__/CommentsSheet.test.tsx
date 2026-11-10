import { render, screen, userEvent } from '@testing-library/react-native';

import type { CommentResponse } from '@/api/generated/journey';
import { onPhone } from '@/test/phone';
import { comment, entry, nora, pages } from '@/test/samples';

import { CommentsSheet } from '../CommentsSheet';

const mockComments = jest.fn();
const mockAdd = jest.fn();
const mockDelete = jest.fn();
let mockAnswer: CommentResponse;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock('@/api/cache', () => ({ useCache: () => ({ commented: jest.fn(() => Promise.resolve()) }) }));
jest.mock('@/features/safety/SafetySheets', () => ({ ReportSheet: () => null }));
jest.mock('@/api/generated/journey', () => ({
  useGetMe: () => ({ data: { profile: { id: 'p-nora', displayName: 'Nora Lind', avatarUrl: null } } }),
  useGetCommentsInfinite: () => mockComments(),
  useAddComment: ({ mutation }: { mutation: { onSuccess: (sent: CommentResponse) => unknown } }) => ({
    mutate: (variables: unknown) => {
      mockAdd(variables);
      void mutation.onSuccess(mockAnswer);
    },
    isPending: false,
    error: null,
  }),
  useDeleteComment: () => ({ mutate: mockDelete, isPending: false, isError: false, error: null }),
}));

const mine = comment('c2', { author: nora, body: 'Thank you!', viewer: { canDelete: true } });

describe('CommentsSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockComments.mockReturnValue(pages([comment('c1', { body: 'What a beach.' }), mine, comment('c3', { parentId: 'c1', body: 'Right?' })]));
  });

  it('shows the thread with replies under the comment they answer', async () => {
    await render(onPhone(<CommentsSheet entry={entry({ commentCount: 3 })} visible onClose={() => {}} />));
    expect(screen.getByRole('header', { name: '3 comments' })).toBeOnTheScreen();
    for (const text of ['What a beach.', 'Thank you!', 'Right?']) expect(screen.getByText(text)).toBeOnTheScreen();
  });

  it('asks before deleting a comment', async () => {
    const user = userEvent.setup();
    await render(onPhone(<CommentsSheet entry={entry()} visible onClose={() => {}} />));
    await user.press(screen.getByRole('button', { name: 'Delete the comment by Nora Lind' }));
    expect(screen.getByRole('header', { name: 'Delete this comment?' })).toBeOnTheScreen();
    expect(mockDelete).not.toHaveBeenCalled();
    await user.press(screen.getByRole('button', { name: 'Delete comment' }));
    expect(mockDelete).toHaveBeenCalledWith({ id: 'c2' });
  });

  it('shows a comment that was just sent, also when its page is not loaded', async () => {
    // The answer from the API is not in the loaded page (a long thread, loaded a page at a time).
    mockAnswer = comment('c99', { author: nora, body: 'Lovely light.' });
    const user = userEvent.setup();
    await render(onPhone(<CommentsSheet entry={entry()} visible onClose={() => {}} />));
    await user.type(screen.getByLabelText('Add a comment'), 'Lovely light.');
    await user.press(screen.getByRole('button', { name: 'Send comment' }));
    expect(mockAdd).toHaveBeenCalledWith(expect.objectContaining({ entryId: 'e1', data: expect.objectContaining({ body: 'Lovely light.' }) }));
    expect(await screen.findByText('Lovely light.')).toBeOnTheScreen();
    expect(screen.getByLabelText('Add a comment')).toHaveDisplayValue('');
  });

  it('belongs to its entry: what was typed and who was being answered stay behind', async () => {
    const user = userEvent.setup();
    const view = await render(onPhone(<CommentsSheet entry={entry({ id: 'e1' })} visible onClose={() => {}} />));
    await user.press(screen.getAllByRole('button', { name: 'Reply to Alex Strand' })[0]!);
    await user.type(screen.getByLabelText('Add a comment'), 'Half a thought');
    expect(screen.getByText('Replying to Alex Strand')).toBeOnTheScreen();

    // Swiping to the next entry shows that entry's comments in the same sheet.
    await view.rerender(onPhone(<CommentsSheet entry={entry({ id: 'e2' })} visible onClose={() => {}} />));
    expect(screen.getByLabelText('Add a comment')).toHaveDisplayValue('');
    expect(screen.queryByText('Replying to Alex Strand')).not.toBeOnTheScreen();
  });
});
