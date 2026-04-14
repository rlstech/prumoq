import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AppLayout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('[AppLayout] getSession ->', session ? `user=${session.user.id}` : 'null → redirecting to login');
      if (!session) router.replace('/(auth)/login');
    });
  }, []);

  return <Slot />;
}
