import { useRouter } from 'expo-router';
import { LogOut, Mail, Trash2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetMe } from '@/api/generated/journey';
import { useSession } from '@/auth/session';
import { layout, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { GroupLabel } from '@/ui/Heading';
import { Row, RowGroup } from '@/ui/Rows';

/** 10.5 Account: how you sign in, and the way out. Deleting the account is right here in the app. */
export default function Account() {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useSession();
  const me = useGetMe().data;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Account" trailing={<View style={{ width: 40 }} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <GroupLabel style={{ marginHorizontal: layout.gutter }}>Sign in with</GroupLabel>
        <RowGroup>
          <Row first icon={(c) => <Mail size={18} color={c} />} label="Email code" note={me?.email} />
        </RowGroup>
        <View style={{ height: 24 }} />
        <RowGroup>
          <Row first icon={(c) => <LogOut size={18} color={c} />} label="Sign out" onPress={() => void session.signOut()} trailing={<View />} />
          <Row danger icon={(c) => <Trash2 size={18} color={c} />} label="Delete account" onPress={() => router.push('/settings/delete-account')} />
        </RowGroup>
      </ScrollView>
    </SafeAreaView>
  );
}
