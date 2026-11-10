import { useRouter } from 'expo-router';
import { Globe, Link as LinkIcon, Lock } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { Pressable, View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { createJourney } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { uploadPhoto } from '@/api/upload';
import { useCatalog } from '@/journey/catalog';
import { type NewJourneyDraft, parseTags, useNewJourney } from '@/journey/draft';
import { useTheme } from '@/theme';
import { AppBar, StepProgress } from '@/ui/AppBar';
import { Button } from '@/ui/Button';
import { GroupLabel, Heading, Lead } from '@/ui/Heading';
import { Screen } from '@/ui/Screen';
import { Txt } from '@/ui/Txt';

const CHOICES: { id: NewJourneyDraft['visibility']; name: string; note: string; icon: (color: string) => ReactNode }[] = [
  { id: 'public', name: 'Public', note: 'Anyone. It can appear in Discover.', icon: (c) => <Globe size={20} color={c} /> },
  { id: 'unlisted', name: 'Unlisted', note: 'Only people with the link. Good for family.', icon: (c) => <LinkIcon size={20} color={c} /> },
  { id: 'private', name: 'Private', note: 'Only you. A journal you can publish later.', icon: (c) => <Lock size={20} color={c} /> },
];

/** 7.6 Who can see it: step 3 of 3. Public, Unlisted or Private in plain words, and whether entries are labelled by day or by part. */
export default function Visibility() {
  const router = useRouter();
  const { colors } = useTheme();
  const catalog = useCatalog();
  const refresh = useRefreshAll();
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
      await refresh();
      router.dismissAll();
      router.push(`/journey/${journey.id}/live` as never);
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
        {CHOICES.map((choice) => {
          const on = draft.visibility === choice.id;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="radio"
              accessibilityLabel={`${choice.name}. ${choice.note}`}
              accessibilityState={{ checked: on }}
              onPress={() => change({ visibility: choice.id })}
              style={{
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 14,
                paddingVertical: on ? 14.5 : 15,
                paddingHorizontal: on ? 15.5 : 16,
                borderRadius: 20,
                backgroundColor: colors.bg,
                borderWidth: on ? 2 : 1.5,
                borderColor: on ? colors.text : colors.line,
              }}>
              <View style={{ width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fill }}>{choice.icon(colors.text)}</View>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt weight={800} style={{ fontSize: 15.5, lineHeight: 20, letterSpacing: -0.15 }}>
                  {choice.name}
                </Txt>
                <Txt color="muted" style={{ fontSize: 13, lineHeight: 18 }}>
                  {choice.note}
                </Txt>
              </View>
              <View style={{ width: 22, height: 22, borderRadius: 11, marginTop: 2, borderWidth: on ? 7 : 2, borderColor: on ? colors.text : colors.lineStrong }} />
            </Pressable>
          );
        })}
      </View>

      <GroupLabel>Label entries as</GroupLabel>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', marginHorizontal: -4, padding: 4, borderRadius: 16, backgroundColor: colors.fill }}>
        {(['day', 'part'] as const).map((style) => {
          const on = labelStyle === style;
          return (
            <Pressable
              key={style}
              accessibilityRole="radio"
              accessibilityLabel={style === 'day' ? 'Day 1, Day 2 and so on' : 'Part 1, Part 2 and so on'}
              accessibilityState={{ checked: on }}
              onPress={() => change({ labelStyle: style })}
              style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', backgroundColor: on ? colors.bg : 'transparent', boxShadow: on ? '0 1px 4px rgba(0, 0, 0, 0.14)' : undefined }}>
              <Txt weight={700} style={{ fontSize: 14, lineHeight: 19, color: on ? colors.text : colors.muted }}>
                {style === 'day' ? 'Day 1, Day 2…' : 'Part 1, Part 2…'}
              </Txt>
            </Pressable>
          );
        })}
      </View>
      <Txt color="muted" style={{ fontSize: 12.5, lineHeight: 18, marginTop: 8, marginHorizontal: 4 }}>
        {labelStyle === 'day' ? 'Days count from the start date, so a quiet day leaves a gap.' : 'Parts count your entries, one after another.'}
      </Txt>
    </Screen>
  );
}
