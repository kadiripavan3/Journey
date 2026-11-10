import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

/** Placeholder until the Follow milestone. */
export default function Activity() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 90 }}>
        <EmptyState emoji="🔔" title="Nothing new yet" body="New entries, comments and followers will show up here." />
      </View>
    </SafeAreaView>
  );
}
