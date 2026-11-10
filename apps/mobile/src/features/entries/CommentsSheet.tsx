import { useRouter } from 'expo-router';
import { Send, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useCache } from '@/api/cache';
import { type CommentResponse, type EntryResponse, useAddComment, useDeleteComment, useGetCommentsInfinite, useGetMe } from '@/api/generated/journey';
import { paged, rows } from '@/api/pages';
import { ReportSheet } from '@/features/safety/SafetySheets';
import { timeAgo } from '@/lib/dates';
import { newClientId } from '@/lib/ids';
import { firstName } from '@/lib/names';
import { plural } from '@/lib/plural';
import { layout, radius, textStyle, useTheme } from '@/theme';
import { Avatar } from '@/ui/Avatar';
import { Loading } from '@/ui/Loading';
import { MoreButton } from '@/ui/MoreButton';
import { Problem } from '@/ui/Problem';
import { RoundButton } from '@/ui/RoundButton';
import { Sheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { webNoOutline } from '@/ui/web';

/** 6.4 Comments: a sheet over the entry. One level of replies keeps threads readable, and the creator's words are marked. */
export function CommentsSheet({ entry, visible, onClose }: { entry: EntryResponse; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const cache = useCache();
  const me = useGetMe().data?.profile;
  const comments = useGetCommentsInfinite(entry.id, undefined, { query: { ...paged, enabled: visible } });
  // One id per comment being written: sending it again after a lost answer still makes one comment.
  const [draftId, setDraftId] = useState(newClientId);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentResponse | null>(null);
  const [reporting, setReporting] = useState<CommentResponse | null>(null);
  const add = useAddComment({
    mutation: {
      onSuccess: () => {
        setText('');
        setReplyTo(null);
        setDraftId(newClientId());
        return cache.commented(entry.id);
      },
    },
  });
  const remove = useDeleteComment({ mutation: { onSuccess: () => cache.commented(entry.id) } });

  const all = rows(comments.data) ?? [];
  // The entry knows how many comments it has; only some of them may be loaded yet.
  const total = Math.max(entry.commentCount, all.length);
  const threads = all.filter((c) => !c.parentId);
  const repliesTo = (id: string) => all.filter((c) => c.parentId === id);
  const first = firstName(entry.author.displayName);
  const failed = add.error ?? remove.error;
  const openProfile = (username: string) => {
    onClose();
    router.push(`/profile/${username}`);
  };
  const send = () => {
    if (text.trim() && !add.isPending) add.mutate({ entryId: entry.id, data: { body: text.trim(), parentId: replyTo?.id, clientId: draftId } });
  };

  const row = (comment: CommentResponse, reply: boolean) => (
    <View key={comment.id} style={{ flexDirection: 'row', gap: 10, marginTop: reply ? 12 : 16, marginLeft: reply ? 44 : 0 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${comment.author.displayName}'s profile`} onPress={() => openProfile(comment.author.username)}>
        <Avatar uri={comment.author.avatarUrl} name={comment.author.displayName} size={reply ? 28 : 34} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt variant="note" numberOfLines={1} weight={800} style={{ flexShrink: 1 }}>
            {comment.author.displayName}
          </Txt>
          {comment.byCreator ? (
            <View style={{ paddingVertical: 2, paddingHorizontal: 6, borderRadius: radius.chip, backgroundColor: colors.accentSoft }}>
              <Txt variant="micro" style={{ color: colors.accentText }}>
                Creator
              </Txt>
            </View>
          ) : null}
          <Txt variant="small" weight={500} color="muted">
            {timeAgo(comment.createdAt)}
          </Txt>
        </View>
        <Txt variant="callout" style={{ marginTop: 2 }}>{comment.body}</Txt>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${comment.author.displayName}`} hitSlop={8} onPress={() => setReplyTo(comment)}>
            <Txt variant="footnote" color="muted" weight={700}>
              Reply
            </Txt>
          </Pressable>
          {comment.viewer.canDelete ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete the comment by ${comment.author.displayName}`} hitSlop={8} disabled={remove.isPending} onPress={() => remove.mutate({ id: comment.id })}>
              <Txt variant="footnote" color="muted" weight={700}>
                Delete
              </Txt>
            </Pressable>
          ) : null}
          {comment.author.id !== me?.id ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Report the comment by ${comment.author.displayName}`} hitSlop={8} onPress={() => setReporting(comment)}>
              <Txt variant="footnote" color="muted" weight={700}>
                Report
              </Txt>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      tall
      title={total === 0 ? 'Comments' : plural(total, 'comment')}
      action={<RoundButton label="Close comments" onPress={onClose} icon={(c) => <X size={18} color={c} />} />}
      footer={
        <View>
          {failed ? (
            <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ paddingHorizontal: layout.barGutter, paddingTop: 8 }}>
              {messageFor(failed)}
            </Txt>
          ) : null}
          {replyTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: layout.barGutter, paddingTop: 8 }}>
              <Txt variant="footnote" numberOfLines={1} color="muted" style={{ flex: 1 }}>
                Replying to {replyTo.author.displayName}
              </Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Stop replying" hitSlop={10} onPress={() => setReplyTo(null)}>
                <X size={16} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: layout.barGutter, paddingTop: 12, paddingBottom: 4 }}>
            <Avatar uri={me?.avatarUrl} name={me?.displayName ?? ' '} size={34} />
            <TextInput
              accessibilityLabel="Add a comment"
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? `Reply to ${firstName(replyTo.author.displayName)}…` : `Add a comment for ${first}…`}
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={send}
              style={[webNoOutline, textStyle('callout', 500, { oneLine: true }), { flex: 1, height: 42, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.fill, color: colors.text }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              accessibilityState={{ disabled: !text.trim() || add.isPending }}
              disabled={!text.trim() || add.isPending}
              onPress={send}
              style={{ width: 40, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: text.trim() ? 1 : 0.38 }}>
              <Send size={18} color={colors.onAccent} />
            </Pressable>
          </View>
        </View>
      }>
      <ReportSheet target={reporting ? { type: 'comment', id: reporting.id, word: 'comment' } : null} onClose={() => setReporting(null)} />
      <View style={{ paddingHorizontal: layout.rowGutter, paddingBottom: 20 }}>
        {comments.isPending ? (
          <View style={{ height: 160 }}>
            <Loading />
          </View>
        ) : comments.isError ? (
          <View style={{ height: 240 }}>
            <Problem message={messageFor(comments.error)} onRetry={() => void comments.refetch()} retrying={comments.isRefetching} />
          </View>
        ) : threads.length === 0 ? (
          <Txt variant="bodySmall" color="muted" center style={{ marginTop: 40 }}>
            No comments yet. Say something nice to {first}.
          </Txt>
        ) : (
          <>
            {threads.map((comment) => (
              <View key={comment.id}>
                {row(comment, false)}
                {repliesTo(comment.id).map((reply) => row(reply, true))}
              </View>
            ))}
            <MoreButton pages={comments} label="Show more comments" />
          </>
        )}
      </View>
    </Sheet>
  );
}
