import { useRouter } from 'expo-router';
import { Flag, Pencil, Share2, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { type EntryResponse, useDeleteEntry } from '@/api/generated/journey';
import { ReportSheet } from '@/features/safety/SafetySheets';
import { layout } from '@/theme';
import { Button } from '@/ui/Button';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

type Props = {
  entry: EntryResponse;
  visible: boolean;
  onClose: () => void;
  onShare: () => void;
  /** The entry was deleted: the screen showing it has nothing left to show. */
  onDeleted: () => void;
};

/** 6.5 Entry options: share it, and change or delete your own (after confirming). Someone else's can be reported. */
export function EntryMenu({ entry, visible, onClose, onShare, onDeleted }: Props) {
  const router = useRouter();
  const cache = useCache();
  const [confirming, setConfirming] = useState(false);
  const [reporting, setReporting] = useState(false);
  const close = () => {
    setConfirming(false);
    onClose();
  };
  const share = (first: boolean) => (
    <SheetRow
      first={first}
      icon={(c) => <Share2 size={22} color={c} />}
      label={words.entry.menu.share}
      onPress={() => {
        close();
        onShare();
      }}
    />
  );
  const remove = useDeleteEntry({
    mutation: {
      onSuccess: async () => {
        close();
        onDeleted();
        await cache.entrySaved(entry.journeyId, entry.id);
      },
    },
  });
  if (!entry.viewer.canDelete) {
    return (
      <>
        <Sheet visible={visible} onClose={close}>
          {share(true)}
          <SheetRow
            icon={(c) => <Flag size={22} color={c} />}
            label={words.entry.menu.report}
            onPress={() => {
              close();
              setReporting(true);
            }}
          />
        </Sheet>
        <ReportSheet target={reporting ? { type: 'entry', id: entry.id } : null} onClose={() => setReporting(false)} />
      </>
    );
  }
  return (
    <Sheet visible={visible} onClose={close} title={confirming ? words.entry.menu.confirmDelete.title : undefined} subtitle={confirming ? words.entry.menu.confirmDelete.body : undefined}>
      {remove.isError ? (
        <Txt variant="caption" color="danger" style={{ paddingHorizontal: layout.gutter, paddingBottom: 8 }}>
          {messageFor(remove.error)}
        </Txt>
      ) : null}
      {confirming ? (
        <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button label={words.entry.menu.delete} variant="danger" size="lg" block loading={remove.isPending} onPress={() => remove.mutate({ id: entry.id })} />
          <Button label={words.common.keepIt} variant="soft" size="lg" block onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <>
          {entry.viewer.canEdit ? (
            <SheetRow
              first
              icon={(c) => <Pencil size={22} color={c} />}
              label={words.entry.menu.edit}
              onPress={() => {
                close();
                router.push(`/journey/${entry.journeyId}/add?entry=${entry.id}`);
              }}
            />
          ) : null}
          {share(!entry.viewer.canEdit)}
          <SheetRow danger icon={(c) => <Trash2 size={22} color={c} />} label={words.entry.menu.delete} onPress={() => setConfirming(true)} />
        </>
      )}
    </Sheet>
  );
}
