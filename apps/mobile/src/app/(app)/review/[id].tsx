import { useLocalSearchParams } from 'expo-router';
import { CircleCheck, ShieldAlert } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { askSecondLook, useChangeEntry, useGetEntry } from '@/api/generated/journey';
import { entryEyebrow } from '@/features/entries/labels';
import { saveRequest } from '@/features/entries/saveRequest';
import { useLeave } from '@/features/navigation/useLeave';
import { HeldVeil } from '@/features/safety/Held';
import { radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Eyebrow } from '@/ui/Eyebrow';
import { Loading } from '@/ui/Loading';
import { NoteBox } from '@/ui/NoteBox';
import { Photo } from '@/ui/Photo';
import { Problem } from '@/ui/Problem';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/**
 * 11.3 Held for review: when the automatic check flags a photo, it is hidden until a person has looked at it.
 * The one who posted it hears what happened and what comes next, and can remove the photo or ask for a second look.
 */
export default function HeldForReview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const leave = useLeave();
  const { colors, shadow } = useTheme();
  const cache = useCache();
  const entry = useGetEntry(id);
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState(false);
  const [askProblem, setAskProblem] = useState<string | null>(null);
  const change = useChangeEntry({
    mutation: {
      onSuccess: async (saved) => {
        await cache.entrySaved(saved.journeyId, saved.id);
        leave();
      },
    },
  });

  const e = entry.data;
  const held = e?.media.filter((m) => m.held) ?? [];
  const fine = e?.media.filter((m) => !m.held) ?? [];
  const one = held.length === 1;
  // The design shows a photo that is fine beside the one that is hidden; with nothing else, the hidden ones alone.
  const shown = [...fine.slice(0, 1), ...held].slice(0, 2);

  const remove = () => {
    if (!e) return;
    // Everything the entry has stays as it is (its place and the spot on the map too); only the held photos go.
    change.mutate({ id: e.id, data: saveRequest(e, { mediaIds: fine.map((m) => m.id) }) });
  };
  const askAgain = async () => {
    setAsking(true);
    setAskProblem(null);
    try {
      await Promise.all(held.map((m) => askSecondLook(m.id)));
      setAsked(true);
    } catch (error) {
      setAskProblem(messageFor(error));
    } finally {
      setAsking(false);
    }
  };

  const problem = change.isError ? messageFor(change.error) : askProblem;
  return (
    <Screen
      header={<AppBar title={e ? `${e.label} · ${e.journeyTitle}` : undefined} trailing={<View style={{ width: 40 }} />} />}
      footer={
        e && held.length > 0 ? (
          <>
            {problem ? (
              <Txt variant="caption" color="danger" center accessibilityLiveRegion="polite">
                {problem}
              </Txt>
            ) : null}
            <Button label={one ? 'Remove the photo' : 'Remove the photos'} variant="line" size="lg" block loading={change.isPending} onPress={remove} />
            {asked ? (
              <Txt variant="small" color="muted" center accessibilityLiveRegion="polite">
                Thanks. We&apos;ll take a second look.
              </Txt>
            ) : (
              <Txt variant="small" color="muted" center>
                Think it&apos;s a mistake?{' '}
                <Txt variant="small" weight={700} accessibilityRole="link" disabled={asking} onPress={() => void askAgain()} style={{ color: colors.accentText }}>
                  Ask for a second look
                </Txt>
              </Txt>
            )}
          </>
        ) : undefined
      }>
      {entry.isPending ? (
        <View style={{ height: 320 }}>
          <Loading />
        </View>
      ) : entry.isError || !e ? (
        <View style={{ height: 320 }}>
          <Problem message={messageFor(entry.error)} onRetry={() => void entry.refetch()} retrying={entry.isRefetching} />
        </View>
      ) : (
        <>
          <View style={{ marginTop: 4, marginHorizontal: -4, marginBottom: 16, padding: 10, borderRadius: radius.panel, backgroundColor: colors.surface, boxShadow: shadow.sm }}>
            {shown.length > 0 ? (
              <View style={{ flexDirection: 'row', gap: 6, height: 210 }}>
                {shown.map((photo) => (
                  <Photo key={photo.id} uri={photo.thumbUrl ?? photo.url} radius="field" style={{ flex: 1 }}>
                    {photo.held ? <HeldVeil /> : null}
                  </Photo>
                ))}
              </View>
            ) : null}
            <View style={{ paddingTop: 12, paddingHorizontal: 6, paddingBottom: 6 }}>
              <Eyebrow>{entryEyebrow(e)}</Eyebrow>
              {e.title ? (
                <Txt variant="subheading" weight={800} style={{ marginTop: 3 }}>
                  {e.title}
                </Txt>
              ) : null}
              {e.body ? (
                <Txt variant="note" color="muted" numberOfLines={4} style={{ marginTop: 4 }}>
                  {e.body}
                </Txt>
              ) : null}
            </View>
          </View>
          {held.length > 0 ? (
            <NoteBox tone="warn" icon={(c) => <ShieldAlert size={20} color={c} />} title={one ? 'One photo is being reviewed' : `${held.length} photos are being reviewed`} style={{ marginHorizontal: -4 }}>
              {one
                ? "Our automatic check flagged it, so it's hidden from everyone but you. A person will look at it soon."
                : "Our automatic check flagged them, so they're hidden from everyone but you. A person will look at them soon."}
            </NoteBox>
          ) : (
            <>
              <NoteBox icon={() => <CircleCheck size={20} color={colors.ok} />} title="Nothing is being reviewed" style={{ marginHorizontal: -4 }}>
                Every photo in this entry can be seen by everyone who can see the journey.
              </NoteBox>
              <Pressable accessibilityRole="button" accessibilityLabel="Back to the entry" onPress={leave} style={{ alignSelf: 'center', marginTop: 20 }}>
                <Txt variant="item" weight={800} style={{ color: colors.accentText }}>
                  Back to the entry
                </Txt>
              </Pressable>
            </>
          )}
        </>
      )}
    </Screen>
  );
}
