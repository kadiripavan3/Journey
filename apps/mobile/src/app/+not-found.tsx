import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { useSession } from '@/auth/session';
import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

/**
 * Shown for an address the app has no screen for: a link made for a newer version of Journey, or one that
 * was typed wrong. It says so in the app's own words and offers the one way on that always works.
 */
export default function NotFound() {
  const router = useRouter();
  const { colors } = useTheme();
  const signedIn = useSession().status === 'signedIn';
  return (
    <View style={{ flex: 1, justifyContent: 'center', paddingVertical: 48, backgroundColor: colors.bg }}>
      <EmptyState
        emoji="🗺️"
        title="There's nothing at this address"
        body={signedIn ? 'The link may be old, or made for a newer Journey. Everything you follow is on Home.' : 'The link may be old, or made for a newer Journey.'}
        action={<Button label={signedIn ? 'Go to Home' : 'Go to the start'} onPress={() => router.replace('/')} />}
      />
    </View>
  );
}
