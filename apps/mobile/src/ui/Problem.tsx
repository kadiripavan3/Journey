import { View } from 'react-native';

import { Button } from './Button';
import { Txt } from './Txt';

/** Shown when a screen's data couldn't be fetched: what happened, in a sentence, and a way to try again. */
export function Problem({ message, onRetry, retrying }: { message: string; onRetry?: () => void; retrying?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
      <Txt variant="titleSmall" accessibilityRole="header" center>
        That didn&apos;t load
      </Txt>
      <Txt variant="bodySmall" color="muted" center>
        {message}
      </Txt>
      {onRetry ? <Button label="Try again" variant="line" loading={retrying} onPress={onRetry} style={{ alignSelf: 'center', marginTop: 6 }} /> : null}
    </View>
  );
}
