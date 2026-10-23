import { StrictMode, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { queryClient } from '@/lib/compat/query-client';
import { clearAuthContext } from '@/lib/auth/context';
import { router } from '@/router';
import './globals.css';

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
if (!publishableKey) throw new Error('VITE_CLERK_PUBLISHABLE_KEY não configurada.');

// Troca de usuário (login, logout, outra conta) apaga o perfil em memória e todos os dados em cache.
function LimpaCacheAoTrocarUsuario() {
  const { isLoaded, userId } = useAuth();
  const anterior = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    if (anterior.current !== undefined && anterior.current !== userId) {
      clearAuthContext();
      queryClient.clear();
    }
    anterior.current = userId ?? null;
  }, [isLoaded, userId]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={publishableKey} signInUrl="/admin/login" afterSignOutUrl="/admin/login">
      <QueryClientProvider client={queryClient}>
        <LimpaCacheAoTrocarUsuario />
        <RouterProvider router={router} />
      </QueryClientProvider>
    </ClerkProvider>
  </StrictMode>,
);
