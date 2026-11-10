import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { useCatalog } from '@/journey/catalog';
import { useNewJourney } from '@/journey/draft';
import { useTheme } from '@/theme';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Loading, Problem } from '@/ui/Bits';
import { Button } from '@/ui/Button';
import { Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { TemplateCard } from '@/ui/TemplateCard';
import { Txt } from '@/ui/Txt';

const POPULAR = ['trip', 'challenge30'];

/** 7.4 Choose a template: new journey, step 1 of 3. Five starting points; Trip and 30-Day Challenge come first. */
export default function ChooseTemplate() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ template?: string }>();
  const catalog = useCatalog();
  const { draft, change, reset } = useNewJourney();

  // Every visit starts a fresh journey, with the template asked for (if any) already picked.
  useEffect(() => {
    reset(params.template);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the flow opens
  }, []);

  const cards = catalog.templates.filter((t) => t.id !== 'journal');
  const journal = catalog.template('journal');
  const pick = (id: string) => change({ template: id, category: null, labelStyle: null });

  return (
    <Screen
      header={<AppBar leading="close" center={<StepProgress step={1} />} />}
      footer={<Button label="Continue" size="lg" block disabled={!catalog.template(draft.template)} onPress={() => router.push('/new/details' as never)} />}>
      <Heading style={{ marginTop: 6 }}>What kind of journey?</Heading>
      <Lead>Pick a starting point. You can change anything later.</Lead>
      {catalog.query.isPending ? (
        <View style={{ height: 240 }}>
          <Loading />
        </View>
      ) : catalog.query.isError ? (
        <View style={{ height: 280 }}>
          <Problem error={catalog.query.error} onRetry={() => void catalog.query.refetch()} retrying={catalog.query.isRefetching} />
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
            <Pressable
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
                borderRadius: 18,
                backgroundColor: colors.fill,
                borderWidth: 2,
                borderColor: draft.template === journal.id ? colors.text : colors.fill,
              }}>
              <Txt accessible={false} style={{ fontSize: 22, lineHeight: 28 }}>
                {journal.emoji}
              </Txt>
              <Txt style={{ flex: 1, fontSize: 14, lineHeight: 20 }}>
                <Txt weight={800} style={{ fontSize: 14, lineHeight: 20 }}>
                  {journal.name}
                </Txt>
                {` · ${journal.description.charAt(0).toLowerCase()}${journal.description.slice(1)}`}
              </Txt>
              <ChevronRight size={18} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
