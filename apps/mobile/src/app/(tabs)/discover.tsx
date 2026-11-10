import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

/** Placeholder until the Discover milestone. */
export default function Discover() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 90 }}>
        <EmptyState emoji="🔭" title="Discover is on its way" body="Soon you'll find journeys here by category, place, person or tag." />
      </View>
    </SafeAreaView>
  );
}
