import { useRouter } from 'expo-router';
import { ChevronRight, CloudUpload, TriangleAlert, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { plural } from '@/words/en/plural';
import { layout, radius, useTheme } from '@/theme';
import { Tap } from '@/ui/Motion';
import { ProgressBar } from '@/ui/ProgressBar';
import { Txt } from '@/ui/Txt';

import { useOutbox, useProgress } from './outbox';
import { draftTitle, progressLine } from './words';

/** An upload that has only just begun still shows a sliver of the bar. */
export const STARTED = 0.04;

/**
 * On a journey's story: the entries of this journey that are on their way, in one calm line. It says what is
 * happening (going up, waiting for a connection, or refused) and opens Drafts and uploads.
 */
export function PostingBanner({ journeyId }: { journeyId: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const outbox = useOutbox();
  const waiting = outbox.drafts.filter((draft) => draft.journeyId === journeyId && draft.state !== 'draft');
  const first = waiting.find((draft) => draft.state === 'sending') ?? waiting[0];
  const progress = useProgress(first?.clientId);
  if (!first) return null;

  const failed = first.state === 'failed';
  const offline = !outbox.online && !failed;
  const more = waiting.length > 1 ? ` and ${plural(waiting.length - 1, 'more', 'more')}` : '';
  const headline = failed ? `Couldn't post "${draftTitle(first)}"` : offline ? `Saved: "${draftTitle(first)}"${more}` : `Posting "${draftTitle(first)}"${more}`;
  const detail = failed ? (first.problem ?? 'Open it to try again.') : offline ? "It posts by itself when you're back online." : progressLine(progress, outbox.online);

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`${headline}. ${detail} Open drafts and uploads.`}
      accessibilityLiveRegion="polite"
      onPress={() => router.push('/uploads')}
      scaleTo={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: layout.barGutter, marginTop: 10, paddingVertical: 10, paddingHorizontal: 14, borderRadius: radius.photo, backgroundColor: colors.fill }}>
      {failed ? <TriangleAlert size={20} color={colors.warn} /> : offline ? <WifiOff size={20} color={colors.warn} /> : <CloudUpload size={20} color={colors.text} />}
      <View style={{ flex: 1, gap: 2 }}>
        <Txt variant="caption" weight={800} numberOfLines={1}>
          {headline}
        </Txt>
        <Txt variant="footnote" color="muted" numberOfLines={2}>
          {detail}
        </Txt>
        {!failed && !offline ? (
          <View style={{ marginTop: 4 }}>
            <ProgressBar fraction={Math.max(progress?.fraction ?? 0, STARTED)} />
          </View>
        ) : null}
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Tap>
  );
}

/** On your own profile: a way to Drafts and uploads, shown only while something is waiting there. */
export function OutboxLink() {
  const router = useRouter();
  const { colors } = useTheme();
  const outbox = useOutbox();
  if (outbox.drafts.length === 0) return null;
  const drafts = outbox.drafts.filter((draft) => draft.state === 'draft').length;
  const failed = outbox.drafts.filter((draft) => draft.state === 'failed').length;
  const going = outbox.drafts.length - drafts - failed;
  const parts = [going > 0 ? `${going} on ${going === 1 ? 'its' : 'their'} way` : null, failed > 0 ? `${failed} couldn't upload` : null, drafts > 0 ? plural(drafts, 'draft') : null].filter(Boolean);
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={`Drafts and uploads. ${parts.join(', ')}`}
      onPress={() => router.push('/uploads')}
      scaleTo={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: layout.barGutter, marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.photo, backgroundColor: colors.fill }}>
      {failed > 0 ? <TriangleAlert size={20} color={colors.warn} /> : <CloudUpload size={20} color={colors.text} />}
      <View style={{ flex: 1 }}>
        <Txt variant="control" weight={800}>
          Drafts and uploads
        </Txt>
        <Txt variant="footnote" color="muted" numberOfLines={1}>
          {parts.join(' · ')}
        </Txt>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Tap>
  );
}
