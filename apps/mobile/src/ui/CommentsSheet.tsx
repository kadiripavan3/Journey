import { useRouter } from 'expo-router';
import { Send, X } from 'lucide-react-native';
import { useState } from 'react';
import { Platform, Pressable, TextInput, type TextStyle, View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { type CommentResponse, type EntryResponse, useAddComment, useDeleteComment, useGetComments, useGetMe } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { timeAgo } from '@/lib/dates';
import { plural } from '@/lib/plural';
import { fontFor, useTheme } from '@/theme';

import { Avatar } from './Avatar';
import { Loading, Problem } from './Bits';
import { RoundButton } from './RoundButton';
import { ReportSheet } from './SafetySheets';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : null;

/** 6.4 Comments: a sheet over the entry. One level of replies keeps threads readable, and the creator's words are marked. */
export function CommentsSheet({ entry, visible, onClose }: { entry: EntryResponse; visible: boolean; onClose: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const refresh = useRefreshAll();
  const me = useGetMe().data?.profile;
  const comments = useGetComments(entry.id, { query: { enabled: visible } });
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<CommentResponse | null>(null);
  const [reporting, setReporting] = useState<CommentResponse | null>(null);
  const add = useAddComment({
    mutation: {
      onSuccess: () => {
        setText('');
        setReplyTo(null);
        return refresh();
      },
    },
  });
  const remove = useDeleteComment({ mutation: { onSuccess: () => refresh() } });

  const all = comments.data ?? [];
  const threads = all.filter((c) => !c.parentId);
  const repliesTo = (id: string) => all.filter((c) => c.parentId === id);
  const firstName = entry.author.displayName.trim().split(/\s+/)[0];
  const failed = add.error ?? remove.error;
  const openProfile = (username: string) => {
    onClose();
    router.push(`/profile/${username}` as never);
  };
  const send = () => {
    if (text.trim() && !add.isPending) add.mutate({ entryId: entry.id, data: { body: text.trim(), parentId: replyTo?.id } });
  };

  const row = (comment: CommentResponse, reply: boolean) => (
    <View key={comment.id} style={{ flexDirection: 'row', gap: 10, marginTop: reply ? 12 : 16, marginLeft: reply ? 44 : 0 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${comment.author.displayName}'s profile`} onPress={() => openProfile(comment.author.username)}>
        <Avatar uri={comment.author.avatarUrl} name={comment.author.displayName} size={reply ? 28 : 34} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Txt numberOfLines={1} weight={800} style={{ flexShrink: 1, fontSize: 13.5, lineHeight: 18 }}>
            {comment.author.displayName}
          </Txt>
          {comment.byCreator ? (
            <View style={{ paddingVertical: 2, paddingHorizontal: 6, borderRadius: 7, backgroundColor: colors.accentSoft }}>
              <Txt weight={800} style={{ fontSize: 10.5, lineHeight: 13, color: colors.accentText }}>
                Creator
              </Txt>
            </View>
          ) : null}
          <Txt color="muted" style={{ fontSize: 12, lineHeight: 16 }}>
            {timeAgo(comment.createdAt)}
          </Txt>
        </View>
        <Txt style={{ fontSize: 14, lineHeight: 20, marginTop: 2 }}>{comment.body}</Txt>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Reply to ${comment.author.displayName}`} hitSlop={8} onPress={() => setReplyTo(comment)}>
            <Txt color="muted" weight={700} style={{ fontSize: 12.5, lineHeight: 17 }}>
              Reply
            </Txt>
          </Pressable>
          {comment.viewer.canDelete ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Delete the comment by ${comment.author.displayName}`} hitSlop={8} disabled={remove.isPending} onPress={() => remove.mutate({ id: comment.id })}>
              <Txt color="muted" weight={700} style={{ fontSize: 12.5, lineHeight: 17 }}>
                Delete
              </Txt>
            </Pressable>
          ) : null}
          {comment.author.id !== me?.id ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Report the comment by ${comment.author.displayName}`} hitSlop={8} onPress={() => setReporting(comment)}>
              <Txt color="muted" weight={700} style={{ fontSize: 12.5, lineHeight: 17 }}>
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
      title={all.length === 0 ? 'Comments' : plural(all.length, 'comment')}
      action={<RoundButton label="Close comments" onPress={onClose} icon={(c) => <X size={18} color={c} />} />}
      footer={
        <View>
          {failed ? (
            <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {messageFor(failed)}
            </Txt>
          ) : null}
          {replyTo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8 }}>
              <Txt numberOfLines={1} color="muted" style={{ flex: 1, fontSize: 12.5, lineHeight: 17 }}>
                Replying to {replyTo.author.displayName}
              </Txt>
              <Pressable accessibilityRole="button" accessibilityLabel="Stop replying" hitSlop={10} onPress={() => setReplyTo(null)}>
                <X size={16} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 }}>
            <Avatar uri={me?.avatarUrl} name={me?.displayName ?? ' '} size={34} />
            <TextInput
              accessibilityLabel="Add a comment"
              value={text}
              onChangeText={setText}
              placeholder={replyTo ? `Reply to ${replyTo.author.displayName.split(/\s+/)[0]}…` : `Add a comment for ${firstName}…`}
              placeholderTextColor={colors.muted}
              selectionColor={colors.accent}
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={send}
              style={[webNoOutline, { flex: 1, height: 42, paddingHorizontal: 16, borderRadius: 21, backgroundColor: colors.fill, fontFamily: fontFor[500], fontSize: 14, color: colors.text }]}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Send comment"
              accessibilityState={{ disabled: !text.trim() || add.isPending }}
              disabled={!text.trim() || add.isPending}
              onPress={send}
              style={{ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent, opacity: text.trim() ? 1 : 0.38 }}>
              <Send size={18} color={colors.onAccent} />
            </Pressable>
          </View>
        </View>
      }>
      <ReportSheet target={reporting ? { type: 'comment', id: reporting.id, word: 'comment' } : null} onClose={() => setReporting(null)} />
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        {comments.isPending ? (
          <View style={{ height: 160 }}>
            <Loading />
          </View>
        ) : comments.isError ? (
          <View style={{ height: 240 }}>
            <Problem error={comments.error} onRetry={() => void comments.refetch()} retrying={comments.isRefetching} />
          </View>
        ) : threads.length === 0 ? (
          <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22, marginTop: 40 }}>
            No comments yet. Say something nice to {firstName}.
          </Txt>
        ) : (
          threads.map((comment) => (
            <View key={comment.id}>
              {row(comment, false)}
              {repliesTo(comment.id).map((reply) => row(reply, true))}
            </View>
          ))
        )}
      </View>
    </Sheet>
  );
}
