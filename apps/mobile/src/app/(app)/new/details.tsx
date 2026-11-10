import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useCatalog } from '@/features/journeys/catalog';
import { DetailsForm } from '@/features/journeys/DetailsForm';
import { useNewJourney } from '@/features/journeys/draft';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Heading } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { words } from '@/words';

/** 7.5 Journey details: step 2 of 3. A title and a start date are enough; the first photo is the cover until you choose one. */
export default function JourneyDetails() {
  const router = useRouter();
  const catalog = useCatalog();
  const { draft, change } = useNewJourney();
  const template = catalog.template(draft.template);

  return (
    <Screen
      header={<AppBar center={<StepProgress step={2} />} />}
      footer={<Button label={words.common.continue} size="lg" block disabled={draft.title.trim().length === 0} onPress={() => router.push('/new/visibility')} />}>
      <Heading style={{ marginTop: 6 }}>{words.newJourney.details.title}</Heading>
      <View style={{ height: 18 }} />
      <DetailsForm
        // Until the person picks a category, the template's own is shown.
        value={{ title: draft.title, description: draft.description, tags: draft.tags, startDate: draft.startDate, category: draft.category ?? template?.defaultCategory }}
        onChange={change}
        coverUri={draft.cover?.uri}
        onCover={(cover) => change({ cover })}
        titlePlaceholder={template?.id === 'challenge30' ? words.newJourney.details.challengeTitleHint : undefined}
        dayTitle={words.newJourney.details.dayTitle}
      />
    </Screen>
  );
}
