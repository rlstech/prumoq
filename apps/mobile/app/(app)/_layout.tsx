import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export default function AppLayout() {
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/(auth)/login');
    });
  }, []);

  return <Slot />;
}
