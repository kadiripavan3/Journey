import { useRouter } from 'expo-router';
import { KeyRound, LogOut, Mail, Trash2 } from 'lucide-react-native';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useGetMe } from '@/api/generated/journey';
import { useSession } from '@/auth/session';
import { layout, useTheme } from '@/theme';
import { AppBar } from '@/ui/AppBar';
import { GroupLabel } from '@/ui/Heading';
import { Row, RowGroup } from '@/ui/Rows';

const WAYS: Record<string, string | undefined> = { apple: 'Apple', google: 'Google', email: 'Email code' };

/** 10.5 Account: how you sign in, and the way out. Deleting the account is right here in the app. */
export default function Account() {
  const router = useRouter();
  const { colors } = useTheme();
  const session = useSession();
  const me = useGetMe().data;
  // The session names the way in ("apple", "google", "email") once it knows it; until then the screen says
  // only who is signed in, and never claims a way that may not be theirs.
  const how = session.provider ? WAYS[session.provider] : undefined;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <AppBar title="Account" trailing={<View style={{ width: 40 }} />} />
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <GroupLabel style={{ marginHorizontal: layout.gutter }}>{how ? 'Sign in with' : 'Signed in as'}</GroupLabel>
        <RowGroup>
          <Row first icon={(c) => (how ? <KeyRound size={18} color={c} /> : <Mail size={18} color={c} />)} label={how ?? me?.email ?? 'Your account'} note={how ? me?.email : undefined} />
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
