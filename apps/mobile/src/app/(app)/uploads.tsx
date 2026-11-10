import { useRouter } from 'expo-router';
import { ChevronRight, CloudUpload, Film, Pencil, RefreshCw, Trash2, TriangleAlert, WifiOff } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useOutbox, useProgress } from '@/features/drafts/outbox';
import { ProgressBar } from '@/features/drafts/PostingBanner';
import type { Draft } from '@/features/drafts/types';
import { draftSaved, draftTitle, draftWhere, progressLine } from '@/features/drafts/words';
import { layout, radius, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';
import { GroupLabel } from '@/ui/Heading';
import { Rise } from '@/ui/Motion';
import { Photo } from '@/ui/Photo';
import { Sheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

/**
 * 7.4 Drafts and uploads: entries on their way up, ones that were refused (with a way to try again), and
 * drafts. Everything here lives on this phone until it is posted; nothing is lost when the signal goes.
 */
export default function Uploads() {
  const router = useRouter();
  const { colors } = useTheme();
  const outbox = useOutbox();
  const [removing, setRemoving] = useState<Draft | null>(null);

  const going = outbox.drafts.filter((draft) => draft.state === 'queued' || draft.state === 'sending');
  const failed = outbox.drafts.filter((draft) => draft.state === 'failed');
  const drafts = outbox.drafts.filter((draft) => draft.state === 'draft');

  /** Opens a draft in the composer. One that is in line is taken out of it first, so it doesn't go up half changed. */
  const open = (draft: Draft) => {
    if (outbox.hold(draft.clientId)) router.push(`/journey/${draft.journeyId}/add?draft=${draft.clientId}`);
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Drafts and uploads" trailing={<View style={{ width: 40 }} />} />
      {outbox.drafts.length === 0 ? (
        <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 80 }}>
          <EmptyState emoji="📓" title="Nothing waiting" body="Drafts you save, and entries you write without a signal, wait here until they are posted." />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingTop: 4, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
          {!outbox.online ? (
            <Note icon={<WifiOff size={20} color={colors.warn} />} title="You're offline">
              Everything here is saved on this phone. Entries post by themselves when you&apos;re back.
            </Note>
          ) : going.length > 0 ? (
            <Note icon={<CloudUpload size={20} color={colors.text} />} title="On their way">
              Entries go up while Journey is open. If you close it, they carry on from where they stopped next time.
            </Note>
          ) : null}

          {going.length > 0 ? <GroupLabel style={{ marginTop: layout.section, marginHorizontal: layout.gutter, marginBottom: 8 }}>{outbox.online ? 'Uploading' : 'Waiting to upload'}</GroupLabel> : null}
          {going.map((draft, index) => (
            <Rise key={draft.clientId} index={index}>
              <Going draft={draft} online={outbox.online} onOpen={() => open(draft)} />
            </Rise>
          ))}

          {failed.length > 0 ? <GroupLabel style={{ marginTop: layout.section, marginHorizontal: layout.gutter, marginBottom: 8 }}>Couldn&apos;t upload</GroupLabel> : null}
          {failed.map((draft) => (
            <Item
              key={draft.clientId}
              draft={draft}
              onPress={() => open(draft)}
              label={`${draftTitle(draft)}. ${draft.problem ?? "It couldn't be posted."} Open to change it.`}
              trailing={<Button label="Retry" size="sm" variant="soft" inline icon={(c) => <RefreshCw size={15} color={c} />} onPress={() => outbox.retry(draft.clientId)} />}
              onRemove={() => setRemoving(draft)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 5 }}>
                <TriangleAlert size={14} color={colors.warn} style={{ marginTop: 2 }} />
                <Txt variant="footnote" weight={700} numberOfLines={3} style={{ flex: 1, color: colors.warn }}>
                  {draft.problem ?? "It couldn't be posted."}
                </Txt>
              </View>
            </Item>
          ))}

          {drafts.length > 0 ? <GroupLabel style={{ marginTop: layout.section, marginHorizontal: layout.gutter, marginBottom: 8 }}>Drafts</GroupLabel> : null}
          {drafts.map((draft) => (
            <Item key={draft.clientId} draft={draft} sub={draft.journey.title} onPress={() => open(draft)} label={`${draftTitle(draft)}. ${draftSaved(draft)}. Open the draft.`} trailing={<ChevronRight size={18} color={colors.muted} />} onRemove={() => setRemoving(draft)}>
              <Txt variant="footnote" color="muted" numberOfLines={1}>
                {draftSaved(draft)}
              </Txt>
            </Item>
          ))}
        </ScrollView>
      )}

      <Sheet visible={!!removing} onClose={() => setRemoving(null)} title="Delete this draft?" subtitle="It only exists on this phone, so it will be gone for good.">
        <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button
            label="Delete draft"
            variant="danger"
            size="lg"
            block
            onPress={() => {
              if (removing) void outbox.discard(removing.clientId);
              setRemoving(null);
            }}
          />
          <Button label="Keep it" variant="soft" size="lg" block onPress={() => setRemoving(null)} />
        </View>
      </Sheet>
    </SafeAreaView>
  );
}

/** An entry that is going up or waiting for its turn. Only this row draws again as its upload moves on. */
function Going({ draft, online, onOpen }: { draft: Draft; online: boolean; onOpen: () => void }) {
  const progress = useProgress(draft.clientId);
  const waiting = draft.state === 'queued';
  return (
    <Item draft={draft} sub={draftWhere(draft)} onPress={waiting ? onOpen : undefined} label={`${draftTitle(draft)}. ${progressLine(progress, online)}`}>
      {waiting ? null : (
        <View style={{ marginTop: 4, marginBottom: 2 }}>
          <ProgressBar fraction={progress?.fraction ?? 0} />
        </View>
      )}
      <Txt variant="footnote" color="muted" numberOfLines={1}>
        {progressLine(progress, online)}
      </Txt>
    </Item>
  );
}

function Note({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginHorizontal: layout.barGutter, paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.photo, backgroundColor: colors.fill }}>
      <View style={{ marginTop: 1 }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Txt variant="control" weight={800}>
          {title}
        </Txt>
        <Txt variant="note">{children}</Txt>
      </View>
    </View>
  );
}

/** One entry that hasn't been posted: its first photo (or a mark for text or a clip), its title, and what is happening to it. */
function Item({ draft, sub, label, onPress, trailing, onRemove, children }: { draft: Draft; sub?: string; label: string; onPress?: () => void; trailing?: ReactNode; onRemove?: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  const photo = draft.media.find((media) => media.kind === 'photo');
  const body = (
    <>
      {photo ? (
        <Photo uri={photo.uri} radius="thumb" style={{ width: 60, height: 60 }} />
      ) : (
        <View style={{ width: 60, height: 60, borderRadius: radius.thumb, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>
          {draft.media.length > 0 ? <Film size={22} color={colors.muted} /> : <Pencil size={22} color={colors.muted} />}
        </View>
      )}
      <View style={{ flex: 1, gap: 3 }}>
        <Txt variant="item" weight={700} numberOfLines={1}>
          {draftTitle(draft)}
        </Txt>
        {sub ? (
          <Txt variant="footnote" color="muted" numberOfLines={1}>
            {sub}
          </Txt>
        ) : null}
        {children}
      </View>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7, paddingHorizontal: layout.rowGutter }}>
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, opacity: pressed ? 0.7 : 1 })}>
          {body}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {body}
        </View>
      )}
      {trailing}
      {onRemove ? (
        <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${draftTitle(draft)}`} hitSlop={10} onPress={onRemove}>
          <Trash2 size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}
