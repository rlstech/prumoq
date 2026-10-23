import type { ReactNode } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { Navigate, useLocation } from 'react-router';

// Fazia o papel do middleware do Next: sem sessão do Clerk, vai para o login. Perfil, cliente suspenso e
// inspetor são tratados pelos layouts (app/(admin)/layout.tsx, app/(platform)/layout.tsx).
export function RequireSignedIn({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const location = useLocation();
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-0" aria-busy="true" aria-label="Carregando">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brd-0 border-t-brand" />
      </div>
    );
  }
  if (!isSignedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
}
