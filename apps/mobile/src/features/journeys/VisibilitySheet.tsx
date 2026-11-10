import { Check } from 'lucide-react-native';

import { useTheme } from '@/theme';
import { Sheet, SheetRow } from '@/ui/Sheet';

import { VISIBILITY, type Visibility as Value } from './visibility';

/** Who can see a journey: Public, Unlisted or Private, each with what it means. Choosing one closes the sheet. */
export function VisibilitySheet({ visible, onClose, title, value, onChange }: { visible: boolean; onClose: () => void; title: string; value: Value; onChange: (value: Value) => void }) {
  const { colors } = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {VISIBILITY.map((v, index) => (
        <SheetRow
          key={v.id}
          first={index === 0}
          label={v.label}
          note={v.note}
          trailing={v.id === value ? <Check size={20} color={colors.text} strokeWidth={2.6} /> : undefined}
          onPress={() => {
            onChange(v.id);
            onClose();
          }}
        />
      ))}
    </Sheet>
  );
}
