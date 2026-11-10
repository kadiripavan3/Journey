import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { messageFor } from '@/api/fetcher';
import { useBlockProfile, useReport } from '@/api/generated/journey';
import { useRefreshAll } from '@/api/refresh';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { Sheet } from './Sheet';
import { Txt } from './Txt';

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
  const [reason, setReason] = useState<string | null>(null);
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
        <View style={{ paddingHorizontal: 20, paddingTop: 6 }}>
          <Button label="Done" size="lg" block onPress={close} />
        </View>
      ) : (
        <>
          <View accessibilityRole="radiogroup">
            {REASONS.map((r, index) => {
              const on = r.id === reason;
              return (
                <Pressable
                  key={r.id}
                  accessibilityRole="radio"
                  accessibilityLabel={r.label}
                  accessibilityState={{ checked: on }}
                  onPress={() => setReason(r.id)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 22, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
                  <Txt weight={600} style={{ flex: 1, fontSize: 15.5, lineHeight: 21 }}>
                    {r.label}
                  </Txt>
                  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 2, borderColor: on ? colors.text : colors.lineStrong }} />
                </Pressable>
              );
            })}
          </View>
          {report.isError ? (
            <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 22, paddingTop: 8 }}>
              {messageFor(report.error)}
            </Txt>
          ) : null}
          <View style={{ paddingHorizontal: 20, paddingTop: 12 }}>
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
  const refresh = useRefreshAll();
  const block = useBlockProfile({
    mutation: {
      onSuccess: async () => {
        onClose();
        onBlocked();
        await refresh();
      },
    },
  });
  const points = ["They can't see, follow or comment on your journeys", "You won't see their journeys or comments", "They won't be told"];
  return (
    <Sheet visible={person !== null} onClose={onClose} title={`Block ${person?.displayName ?? ''}?`}>
      <View style={{ gap: 10, paddingHorizontal: 22, paddingTop: 8, paddingBottom: 16 }}>
        {points.map((point) => (
          <View key={point} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Check size={18} color={colors.muted} strokeWidth={2.4} />
            <Txt style={{ flex: 1, fontSize: 14.5, lineHeight: 21 }}>{point}</Txt>
          </View>
        ))}
      </View>
      {block.isError ? (
        <Txt variant="caption" color="danger" accessibilityLiveRegion="polite" style={{ paddingHorizontal: 22, paddingBottom: 8 }}>
          {messageFor(block.error)}
        </Txt>
      ) : null}
      <View style={{ gap: 10, paddingHorizontal: 20 }}>
        <Button label="Block" variant="danger" size="lg" block loading={block.isPending} onPress={() => person && block.mutate({ username: person.username })} />
        <Button label="Cancel" variant="soft" size="lg" block onPress={onClose} />
      </View>
    </Sheet>
  );
}
