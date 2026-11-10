import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Emoji } from './Emoji';
import { Txt } from './Txt';

type Props = { emoji: string; title: string; body: string; action?: ReactNode };

/** A friendly "nothing here yet": says what will appear and offers one next step. */
export function EmptyState({ emoji, title, body, action }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingHorizontal: 34 }}>
      <View style={{ width: 116, height: 116, borderRadius: 58, marginBottom: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
        <Emoji char={emoji} size={64} />
      </View>
      <Txt accessibilityRole="header" weight={800} center style={{ fontSize: 21, lineHeight: 26, letterSpacing: -0.5 }}>
        {title}
      </Txt>
      <Txt color="muted" center style={{ fontSize: 14.5, lineHeight: 22 }}>
        {body}
      </Txt>
      {action ? <View style={{ marginTop: 6 }}>{action}</View> : null}
    </View>
  );
}
