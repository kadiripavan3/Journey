import { useRouter } from 'expo-router';
import { ChevronRight, CloudUpload, TriangleAlert, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { layout, radius, useTheme } from '@/theme';
import { Tap } from '@/ui/Motion';
import { ProgressBar } from '@/ui/ProgressBar';
import { Txt } from '@/ui/Txt';
import { words } from '@/words';

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
  const others = waiting.length - 1;
  const headline = failed ? words.drafts.banner.failed(draftTitle(first)) : offline ? words.drafts.banner.saved(draftTitle(first), others) : words.drafts.banner.posting(draftTitle(first), others);
  const detail = failed ? (first.problem ?? words.drafts.banner.tryAgain) : offline ? words.drafts.banner.whenOnline : progressLine(progress, outbox.online);

  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={words.drafts.banner.spoken(headline, detail)}
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
  const parts = [going > 0 ? words.drafts.link.onTheWay(going) : null, failed > 0 ? words.drafts.link.failed(failed) : null, drafts > 0 ? words.drafts.link.drafts(drafts) : null].filter((part) => part !== null);
  return (
    <Tap
      accessibilityRole="button"
      accessibilityLabel={words.drafts.link.spoken(parts)}
      onPress={() => router.push('/uploads')}
      scaleTo={0.985}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: layout.barGutter, marginTop: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: radius.photo, backgroundColor: colors.fill }}>
      {failed > 0 ? <TriangleAlert size={20} color={colors.warn} /> : <CloudUpload size={20} color={colors.text} />}
      <View style={{ flex: 1 }}>
        <Txt variant="control" weight={800}>
          {words.drafts.link.title}
        </Txt>
        <Txt variant="footnote" color="muted" numberOfLines={1}>
          {words.common.join(parts)}
        </Txt>
      </View>
      <ChevronRight size={18} color={colors.muted} />
    </Tap>
  );
}
