import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { Button } from '@/ui/Button';
import { EmptyState } from '@/ui/EmptyState';

/** 3.4 Home, before following: a new account never sees a blank page. The feed arrives with the Follow milestone. */
export default function Home() {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 90 }}>
        <EmptyState
          emoji="🧭"
          title="Your Home is quiet"
          body="Follow a journey and its new entries land here, newest first."
          action={<Button label="Explore journeys" onPress={() => router.navigate('/discover')} />}
        />
      </View>
    </SafeAreaView>
  );
}
