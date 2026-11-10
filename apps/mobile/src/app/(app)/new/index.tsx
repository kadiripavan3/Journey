import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useCatalog } from '@/features/journeys/catalog';
import { useNewJourney } from '@/features/journeys/draft';
import { TemplateCard } from '@/features/journeys/TemplateCard';
import { radius, useTheme } from '@/theme';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { Emoji } from '@/ui/Emoji';
import { Heading, Lead } from '@/ui/Heading';
import { Loading } from '@/ui/Loading';
import { Problem } from '@/ui/Problem';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';
import { Tap } from '@/ui/Motion';

const POPULAR = ['trip', 'challenge30'];

/** 7.4 Choose a template: new journey, step 1 of 3. Five starting points; Trip and 30-Day Challenge come first. */
export default function ChooseTemplate() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ template?: string }>();
  const catalog = useCatalog();
  const { draft, change, reset } = useNewJourney();

  // Opening the flow starts a fresh journey, with the template asked for (if any) already picked. Who can
  // see it is decided on the last step, from what the person chose in Privacy and safety.
  const template = params.template;
  useEffect(() => reset(template), [reset, template]);

  const cards = catalog.templates.filter((t) => t.id !== 'journal');
  const journal = catalog.template('journal');
  const pick = (id: string) => change({ template: id, category: null, labelStyle: null });

  return (
    <Screen
      header={<AppBar leading="close" center={<StepProgress step={1} />} />}
      footer={<Button label="Continue" size="lg" block disabled={!catalog.template(draft.template)} onPress={() => router.push('/new/details')} />}>
      <Heading style={{ marginTop: 6 }}>What kind of journey?</Heading>
      <Lead>Pick a starting point. You can change anything later.</Lead>
      {catalog.query.isPending ? (
        <View style={{ height: 240 }}>
          <Loading offline={catalog.query.isPaused} />
        </View>
      ) : catalog.query.isError && !catalog.query.data ? (
        <View style={{ height: 280 }}>
          <Problem message={messageFor(catalog.query.error)} onRetry={() => void catalog.query.refetch()} retrying={catalog.query.isFetching} />
        </View>
      ) : (
        <View style={{ marginTop: 16, marginHorizontal: -4, gap: 10 }}>
          {[0, 2].map((from) => (
            <View key={from} style={{ flexDirection: 'row', gap: 10 }}>
              {cards.slice(from, from + 2).map((t) => (
                <TemplateCard
                  key={t.id}
                  emoji={t.emoji}
                  name={t.name}
                  description={t.description}
                  tag={POPULAR.includes(t.id) ? 'POPULAR' : undefined}
                  selected={draft.template === t.id}
                  onPress={() => pick(t.id)}
                />
              ))}
            </View>
          ))}
          {journal ? (
            <Tap
              accessibilityRole="button"
              accessibilityLabel={`${journal.name}. ${journal.description}`}
              accessibilityState={{ selected: draft.template === journal.id }}
              onPress={() => pick(journal.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                marginTop: 2,
                paddingVertical: 14,
                paddingHorizontal: 16,
                borderRadius: radius.photo,
                backgroundColor: colors.fill,
                borderWidth: 2,
                borderColor: draft.template === journal.id ? colors.text : colors.fill,
              }}>
              <Emoji char={journal.emoji} size={28} />
              <Txt variant="callout" style={{ flex: 1 }}>
                <Txt variant="callout" weight={800}>
                  {journal.name}
                </Txt>
                {` · ${journal.description.charAt(0).toLowerCase()}${journal.description.slice(1)}`}
              </Txt>
              <ChevronRight size={18} color={colors.muted} />
            </Tap>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
