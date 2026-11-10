import { useRouter } from 'expo-router';
import { Check, Pause, Plus } from 'lucide-react-native';
import { View } from 'react-native';

import type { JourneyResponse } from '@/api/generated/journey';
import { firstName } from '@/lib/names';
import { Button } from '@/ui/Button';
import { NoteBox } from '@/ui/NoteBox';
import { words } from '@/words';

/**
 * On a paused journey's page: why it is quiet, in kind words. A journey pauses by itself after 30 days
 * without an entry, and the note says so; the people who write in it get the two ways on: add an entry,
 * which picks it up again, or complete it.
 */
export function PausedNote({ journey }: { journey: JourneyResponse }) {
  const router = useRouter();
  const writes = journey.viewer.isOwner || journey.viewer.isMember;
  const owner = firstName(journey.owner.displayName);

  return (
    <View style={{ alignSelf: 'stretch', marginTop: 18, gap: 12 }}>
      <NoteBox tone="warn" icon={(c) => <Pause size={20} color={c} />} title={journey.pausedAutomatically ? words.journeys.paused.titleAutomatic : words.journeys.paused.title}>
        {writes ? words.journeys.paused.writer : words.journeys.paused.reader(owner)}
      </NoteBox>
      {writes ? (
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label={words.journeys.paused.addEntry} icon={(c) => <Plus size={18} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${journey.id}/add`)} style={{ flex: 1, paddingHorizontal: 10 }} />
          {journey.viewer.isOwner ? (
            <Button label={words.journeys.paused.complete} variant="line" icon={(c) => <Check size={18} color={c} strokeWidth={2.4} />} onPress={() => router.push(`/journey/${journey.id}/complete`)} style={{ flex: 1, paddingHorizontal: 10 }} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
