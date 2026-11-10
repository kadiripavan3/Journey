import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { EmptyState } from '@/ui/EmptyState';

/** 8.1 Activity, before notifications are built: says what will arrive here. */
export default function Activity() {
  const { colors } = useTheme();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', paddingBottom: 90 }}>
        <EmptyState emoji="🔔" title="Nothing new yet" body="New entries from journeys you follow, and likes and comments on yours, will arrive here." />
      </View>
    </SafeAreaView>
  );
}
