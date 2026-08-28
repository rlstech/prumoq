import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { validateMobileAccess } from '../../lib/auth/mobile-access';

export default function AppLayout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      console.log('[AppLayout] getSession ->', session ? `user=${session.user.id}` : 'null → redirecting to login');
      if (!session) {
        router.replace('/(auth)/login');
        return;
      }
      const accessError = await validateMobileAccess(session.user.id);
      if (accessError) {
        await supabase.auth.signOut();
        router.replace('/(auth)/login');
      }
    }).catch(err => {
      console.warn('[AppLayout] getSession failed', err);
    });
  }, []);

  return <Slot />;
}
