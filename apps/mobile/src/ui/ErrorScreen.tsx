import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { Txt } from './Txt';

type Props = {
  onRetry: () => void;
  /** What went wrong, in the code's own words. Shown small, and only where a developer asked for it. */
  detail?: string;
};

/**
 * Shown in place of a screen that broke. It says so plainly and offers one way on.
 * It needs nothing around it (no safe-area or data providers), so it can stand in for the whole app.
 */
export function ErrorScreen({ onRetry, detail }: Props) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, justifyContent: 'center', gap: 16, paddingVertical: 48, backgroundColor: colors.bg }}>
      <EmptyState
        emoji="🧭"
        title="Something went wrong"
        body="That's on us, not you. Try again. If it keeps happening, close Journey and open it again."
        action={<Button label="Try again" onPress={onRetry} />}
      />
      {detail ? (
        <Txt variant="footnote" color="muted" center selectable style={{ marginHorizontal: 34 }}>
          {detail}
        </Txt>
      ) : null}
    </View>
  );
}
