import { useRouter } from 'expo-router';
import { CircleCheck, Flag, Pause, Pencil, Play, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, useDeleteJourney, useUpdateJourney } from '@/api/generated/journey';
import { ReportSheet } from '@/features/safety/SafetySheets';
import { useGoHome } from '@/features/states/PageProblem';
import { layout } from '@/theme';
import { Button } from '@/ui/Button';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

type Props = { journey: JourneyResponse; visible: boolean; onClose: () => void };

/** What a journey's "more" button opens: the owner's choices for their own journey, a reader's for someone else's. */
export function JourneyMenu(props: Props) {
  return props.journey.viewer.isOwner ? <OwnerMenu {...props} /> : <ViewerMenu {...props} />;
}

/** What the owner can do with a journey: change it, invite people, complete, pause or start it again, or delete it (after confirming). */
function OwnerMenu({ journey, visible, onClose }: Props) {
  const router = useRouter();
  const goHome = useGoHome();
  const cache = useCache();
  const [confirming, setConfirming] = useState(false);
  const close = () => {
    setConfirming(false);
    onClose();
  };
  const update = useUpdateJourney({
    mutation: {
      onSuccess: async (changed) => {
        await cache.journeyChanged(changed);
        close();
      },
    },
  });
  const remove = useDeleteJourney({
    mutation: {
      onSuccess: async () => {
        close();
        // The journey is gone, so there is no "back" to it: Home.
        goHome();
        await cache.journeyDeleted(journey.id);
      },
    },
  });
  const failed = update.error ?? remove.error;
  const go = (path: 'edit' | 'people' | 'complete') => {
    close();
    router.push(`/journey/${journey.id}/${path}`);
  };

  return (
    <Sheet
      visible={visible}
      onClose={close}
      title={confirming ? words.journeys.menu.confirmDelete.title : journey.title}
      subtitle={confirming ? words.journeys.menu.confirmDelete.body(journey.title, journey.entryCount) : undefined}>
      {failed ? (
        <Txt variant="caption" color="danger" style={{ paddingHorizontal: layout.gutter, paddingBottom: 8 }}>
          {messageFor(failed)}
        </Txt>
      ) : null}
      {confirming ? (
        <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button label={words.journeys.menu.delete} variant="danger" size="lg" block loading={remove.isPending} onPress={() => remove.mutate({ id: journey.id })} />
          <Button label={words.common.keepIt} variant="soft" size="lg" block onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <>
          {journey.status !== 'completed' ? <SheetRow first icon={(c) => <Pencil size={22} color={c} />} label={words.journeys.menu.edit} note={words.journeys.menu.editNote} onPress={() => go('edit')} /> : null}
          <SheetRow
            first={journey.status === 'completed'}
            icon={(c) => <Users size={22} color={c} />}
            label={words.journeys.menu.people}
            note={journey.status === 'completed' ? undefined : words.journeys.menu.peopleNote}
            onPress={() => go('people')}
          />
          {journey.status !== 'completed' && journey.entryCount > 0 ? (
            <SheetRow icon={(c) => <CircleCheck size={22} color={c} />} label={words.journeys.menu.complete} note={words.journeys.menu.completeNote} onPress={() => go('complete')} />
          ) : null}
          {journey.status === 'active' ? (
            <SheetRow icon={(c) => <Pause size={22} color={c} />} label={words.journeys.menu.pause} note={words.journeys.menu.pauseNote} onPress={() => update.mutate({ id: journey.id, data: { status: 'paused' } })} />
          ) : journey.status === 'paused' ? (
            <SheetRow icon={(c) => <Play size={22} color={c} />} label={words.journeys.menu.resume} onPress={() => update.mutate({ id: journey.id, data: { status: 'active' } })} />
          ) : null}
          <SheetRow danger icon={(c) => <Trash2 size={22} color={c} />} label={words.journeys.menu.delete} onPress={() => setConfirming(true)} />
        </>
      )}
    </Sheet>
  );
}

/** What anyone else can do: see who writes in a shared journey (and leave, as one of them), or report it. */
function ViewerMenu({ journey, visible, onClose }: Props) {
  const router = useRouter();
  const [reporting, setReporting] = useState(false);
  const shared = journey.authors.length > 1;
  return (
    <>
      <Sheet visible={visible} onClose={onClose} title={journey.title}>
        {shared ? (
          <SheetRow
            first
            icon={(c) => <Users size={22} color={c} />}
            label={words.journeys.menu.people}
            note={journey.viewer.isMember ? words.journeys.menu.peopleNoteMember : undefined}
            onPress={() => {
              onClose();
              router.push(`/journey/${journey.id}/people`);
            }}
          />
        ) : null}
        <SheetRow
          first={!shared}
          icon={(c) => <Flag size={22} color={c} />}
          label={words.journeys.menu.report}
          onPress={() => {
            onClose();
            setReporting(true);
          }}
        />
      </Sheet>
      <ReportSheet target={reporting ? { type: 'journey', id: journey.id } : null} onClose={() => setReporting(false)} />
    </>
  );
}
