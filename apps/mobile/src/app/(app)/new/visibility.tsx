import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { createJourney } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { uploadPhoto } from '@/api/upload';
import { useCatalog } from '@/features/journeys/catalog';
import { parseTags, useNewJourney } from '@/features/journeys/draft';
import { VISIBILITY } from '@/features/journeys/visibility';
import { radius, useTheme } from '@/theme';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { GroupLabel, Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

/** 7.6 Who can see it: step 3 of 3. Public, Unlisted or Private in plain words, and whether entries are labelled by day or by part. */
export default function Visibility() {
  const router = useRouter();
  const { colors, shadow } = useTheme();
  const catalog = useCatalog();
  const cache = useCache();
  const { draft, change } = useNewJourney();
  const [progress, setProgress] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const template = catalog.template(draft.template);
  const labelStyle = draft.labelStyle ?? (template?.labelStyle === 'part' ? 'part' : 'day');

  const create = async () => {
    setProblem(null);
    try {
      let coverMediaId: string | undefined;
      if (draft.cover) {
        setProgress('Uploading the cover');
        coverMediaId = await uploadPhoto(draft.cover);
      }
      setProgress('Creating your journey');
      const journey = await createJourney({
        clientId: draft.clientId,
        title: draft.title.trim(),
        description: draft.description.trim(),
        template: draft.template,
        category: draft.category ?? undefined,
        startDate: draft.startDate,
        visibility: draft.visibility,
        labelStyle,
        tags: parseTags(draft.tags),
        coverMediaId,
      });
      await cache.journeyStarted();
      router.dismissAll();
      router.push(`/journey/${journey.id}/live`);
    } catch (error) {
      setProblem(messageFor(error));
    } finally {
      setProgress(null);
    }
  };

  return (
    <Screen
      header={<AppBar center={<StepProgress step={3} />} />}
      footer={
        <>
          {problem || progress ? (
            <Txt variant="caption" color={problem ? 'danger' : 'muted'} center accessibilityLiveRegion="polite">
              {problem ?? progress}
            </Txt>
          ) : null}
          <Button label="Create journey" size="lg" block loading={progress !== null} onPress={() => void create()} />
        </>
      }>
      <Heading style={{ marginTop: 6 }}>Who can see it?</Heading>
      <Lead>You can change this any time.</Lead>
      <View accessibilityRole="radiogroup" style={{ gap: 10, marginTop: 16, marginHorizontal: -4 }}>
        {VISIBILITY.map((choice) => {
          const note = `${choice.note} ${choice.hint}`.trim();
          const on = draft.visibility === choice.id;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="radio"
              accessibilityLabel={`${choice.label}. ${note}`}
              accessibilityState={{ checked: on }}
              onPress={() => change({ visibility: choice.id })}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
                paddingVertical: on ? 14.5 : 15,
                paddingHorizontal: on ? 15.5 : 16,
                borderRadius: radius.card,
                backgroundColor: colors.bg,
                borderWidth: on ? 2 : 1.5,
                borderColor: on ? colors.text : colors.line,
              }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.tile, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>{choice.icon(colors.text)}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt variant="item" weight={800}>
                  {choice.label}
                </Txt>
                <Txt variant="caption" weight={500} color="muted">
                  {note}
                </Txt>
              </View>
              <View style={{ width: 22, height: 22, borderRadius: radius.pill, marginTop: 2, borderWidth: on ? 7 : 2, borderColor: on ? colors.text : colors.lineStrong }} />
            </Pressable>
          );
        })}
      </View>

      <GroupLabel>Label entries as</GroupLabel>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', marginHorizontal: -4, padding: 4, borderRadius: radius.field, backgroundColor: colors.fill }}>
        {(['day', 'part'] as const).map((style) => {
          const on = labelStyle === style;
          return (
            <Pressable
              key={style}
              accessibilityRole="radio"
              accessibilityLabel={style === 'day' ? 'Day 1, Day 2 and so on' : 'Part 1, Part 2 and so on'}
              accessibilityState={{ checked: on }}
              onPress={() => change({ labelStyle: style })}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 6, borderRadius: radius.tile, alignItems: 'center', backgroundColor: on ? colors.bg : 'transparent', boxShadow: on ? shadow.knob : undefined }}>
              <Txt variant="callout" weight={700} style={{ color: on ? colors.text : colors.muted }}>
                {style === 'day' ? 'Day 1, Day 2…' : 'Part 1, Part 2…'}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt variant="footnote" color="muted" style={{ marginTop: 8, marginHorizontal: 4 }}>
        {labelStyle === 'day' ? 'Days count from the start date, so a quiet day leaves a gap.' : 'Parts count your entries, one after another.'}
      </Txt>
    </Screen>
  );
}
