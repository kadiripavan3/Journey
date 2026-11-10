import { Check } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { type Appearance, setAppearance, useAppearance } from '@/theme/appearance';
import { AppBar } from '@/ui/AppBar';
import { GroupLabel } from '@/ui/Heading';
import { Row, RowGroup } from '@/ui/Rows';

const CHOICES: { id: Appearance; label: string; note: string }[] = [
  { id: 'system', label: 'Automatic', note: 'Follows your phone' },
  { id: 'light', label: 'Light', note: 'Always light' },
  { id: 'dark', label: 'Dark', note: 'Always dark' },
];

/** 10.4 Appearance: light, dark, or whatever the phone is set to. */
export default function AppearanceSettings() {
  const { colors } = useTheme();
  const appearance = useAppearance();
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Appearance" trailing={<View style={{ width: 40 }} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <GroupLabel style={{ marginHorizontal: 22 }}>Theme</GroupLabel>
        <RowGroup>
          {CHOICES.map((choice, index) => (
            <Row
              key={choice.id}
              first={index === 0}
              label={choice.label}
              note={choice.note}
              onPress={() => setAppearance(choice.id)}
              trailing={choice.id === appearance ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : <View />}
            />
          ))}
        </RowGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
