import { useRouter } from 'expo-router';
import { CircleCheck, Flag, Pause, Pencil, Play, Trash2, Users } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { useCache } from '@/api/cache';
import { messageFor } from '@/api/fetcher';
import { type JourneyResponse, useDeleteJourney, useUpdateJourney } from '@/api/generated/journey';
import { ReportSheet } from '@/features/safety/SafetySheets';
import { useGoHome } from '@/features/states/PageProblem';
import { plural } from '@/words/en/plural';
import { layout } from '@/theme';
import { Button } from '@/ui/Button';
import { Sheet, SheetRow } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';

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
      title={confirming ? 'Delete this journey?' : journey.title}
      subtitle={confirming ? `"${journey.title}" and its ${plural(journey.entryCount, 'entry', 'entries')} will be gone for good, for you and everyone following.` : undefined}>
      {failed ? (
        <Txt variant="caption" color="danger" style={{ paddingHorizontal: layout.gutter, paddingBottom: 8 }}>
          {messageFor(failed)}
        </Txt>
      ) : null}
      {confirming ? (
        <View style={{ gap: 10, paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button label="Delete journey" variant="danger" size="lg" block loading={remove.isPending} onPress={() => remove.mutate({ id: journey.id })} />
          <Button label="Keep it" variant="soft" size="lg" block onPress={() => setConfirming(false)} />
        </View>
      ) : (
        <>
          {journey.status !== 'completed' ? <SheetRow first icon={(c) => <Pencil size={22} color={c} />} label="Edit details" note="Title, cover, start date, who can see it" onPress={() => go('edit')} /> : null}
          <SheetRow
            first={journey.status === 'completed'}
            icon={(c) => <Users size={22} color={c} />}
            label="People on this journey"
            note={journey.status === 'completed' ? undefined : 'Invite friends to add their own entries'}
            onPress={() => go('people')}
          />
          {journey.status !== 'completed' && journey.entryCount > 0 ? (
            <SheetRow icon={(c) => <CircleCheck size={22} color={c} />} label="Complete journey" note="Add a closing note and get the recap" onPress={() => go('complete')} />
          ) : null}
          {journey.status === 'active' ? (
            <SheetRow icon={(c) => <Pause size={22} color={c} />} label="Pause journey" note="Followers see it's on hold. A new entry starts it again." onPress={() => update.mutate({ id: journey.id, data: { status: 'paused' } })} />
          ) : journey.status === 'paused' ? (
            <SheetRow icon={(c) => <Play size={22} color={c} />} label="Resume journey" onPress={() => update.mutate({ id: journey.id, data: { status: 'active' } })} />
          ) : null}
          <SheetRow danger icon={(c) => <Trash2 size={22} color={c} />} label="Delete journey" onPress={() => setConfirming(true)} />
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
            label="People on this journey"
            note={journey.viewer.isMember ? 'See who writes here, or leave' : undefined}
            onPress={() => {
              onClose();
              router.push(`/journey/${journey.id}/people`);
            }}
          />
        ) : null}
        <SheetRow
          first={!shared}
          icon={(c) => <Flag size={22} color={c} />}
          label="Report this journey"
          onPress={() => {
            onClose();
            setReporting(true);
          }}
        />
      </Sheet>
      <ReportSheet target={reporting ? { type: 'journey', id: journey.id, word: 'journey' } : null} onClose={() => setReporting(false)} />
    </>
  );
}
