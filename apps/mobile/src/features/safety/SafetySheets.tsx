import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { type ReportReason, useBlockProfile, useReport } from '@/api/generated/journey';
import { useCache } from '@/api/cache';
import { layout, radius, useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { Sheet } from '@/ui/Sheet';
import { Txt } from '@/ui/Txt';
import { Tap } from '@/ui/Motion';

const REASONS = [
  { id: 'spam', label: 'Spam or a scam' },
  { id: 'harassment', label: 'Hate or harassment' },
  { id: 'nudity', label: 'Nudity or sexual content' },
  { id: 'violence', label: 'Violence or something dangerous' },
  { id: 'impersonation', label: 'Pretending to be someone else' },
  { id: 'other', label: 'Something else' },
] as const;

export type ReportTarget = { type: 'journey' | 'entry' | 'comment' | 'profile'; id: string; word: string };

/** 11.1 Report: pick a reason, send. Reports are private, and a person reviews each one. */
export function ReportSheet({ target, onClose }: { target: ReportTarget | null; onClose: () => void }) {
  const { colors } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [sent, setSent] = useState(false);
  const report = useReport({ mutation: { onSuccess: () => setSent(true) } });
  const close = () => {
    setReason(null);
    setSent(false);
    report.reset();
    onClose();
  };

  return (
    <Sheet
      visible={target !== null}
      onClose={close}
      title={sent ? 'Thanks for telling us' : `Why are you reporting this ${target?.word ?? ''}?`}
      subtitle={sent ? 'A person will look at it. Your report stays private.' : "Reports are private. The person won't know it was you."}>
      {sent ? (
        <View style={{ paddingHorizontal: layout.rowGutter, paddingTop: 6 }}>
          <Button label="Done" size="lg" block onPress={close} />
        </View>
      ) : (
        <>
          <View accessibilityRole="radiogroup">
            {REASONS.map((r, index) => {
              const on = r.id === reason;
              return (
                <Tap
                  key={r.id}
                  accessibilityRole="radio"
                  accessibilityLabel={r.label}
                  accessibilityState={{ checked: on }}
                  onPress={() => setReason(r.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: layout.gutter, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
                  <Txt variant="item" weight={600} style={{ flex: 1 }}>
                    {r.label}
                  </Txt>
                  <View style={{ width: 22, height: 22, borderRadius: radius.pill, borderWidth: on ? 7 : 2, borderColor: on ? colors.text : colors.lineStrong }} />
                </Tap>
              );
            })}
          </View>
          {report.isError ? (
            <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ paddingHorizontal: layout.gutter, paddingTop: 8 }}>
              {messageFor(report.error)}
            </Txt>
          ) : null}
          <View style={{ paddingHorizontal: layout.rowGutter, paddingTop: 12 }}>
            <Button
              label="Send report"
              size="lg"
              block
              disabled={!reason}
              loading={report.isPending}
              onPress={() => target && reason && report.mutate({ data: { targetType: target.type, targetId: target.id, reason } })}
            />
          </View>
        </>
      )}
    </Sheet>
  );
}

/** 11.2 Block: says what will happen before it happens. It's quiet: the other person isn't told. */
export function BlockSheet({ person, onClose, onBlocked }: { person: { username: string; displayName: string } | null; onClose: () => void; onBlocked: () => void }) {
  const { colors } = useTheme();
  const cache = useCache();
  const block = useBlockProfile({
    mutation: {
      onSuccess: async () => {
        onClose();
        onBlocked();
        await cache.blockChanged();
      },
    },
  });
  const points = ["They can't see, follow or comment on your journeys in the app", "You won't see their journeys or comments", "They won't be told"];
  return (
    <Sheet visible={person !== null} onClose={onClose} title={`Block ${person?.displayName ?? ''}?`}>
      <View style={{ gap: 10, paddingHorizontal: layout.gutter, paddingTop: 8, paddingBottom: 16 }}>
        {points.map((point) => (
          <View key={point} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Check size={18} color={colors.muted} strokeWidth={2.4} />
            <Txt variant="bodySmall" style={{ flex: 1 }}>{point}</Txt>
          </View>
        ))}
      </View>
      {block.isError ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ paddingHorizontal: layout.gutter, paddingBottom: 8 }}>
          {messageFor(block.error)}
        </Txt>
      ) : null}
      <View style={{ gap: 10, paddingHorizontal: layout.rowGutter }}>
        <Button label="Block" variant="danger" size="lg" block loading={block.isPending} onPress={() => person && block.mutate({ username: person.username })} />
        <Button label="Cancel" variant="soft" size="lg" block onPress={onClose} />
      </View>
    </Sheet>
  );
}
