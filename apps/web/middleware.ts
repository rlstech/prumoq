import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  // With basePath '/admin', Next.js strips the prefix before middleware sees it.
  // pathname is '/login', '/dashboard', etc. — not '/admin/login'.
  const isLoginPage = pathname === '/login';
  const isSuspendedPage = pathname === '/suspenso';
  const isProtected =
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/suspenso') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon');

  if (!user && isProtected) {
    const redirectResponse = NextResponse.redirect(new URL('/admin/login', request.url));
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user && isLoginPage) {
    const { data: profile } = await supabase
      .from('usuarios')
      .select('perfil, cliente_id, ativo')
      .eq('id', user.id)
      .maybeSingle();
    let destination = '/admin/dashboard';
    if (!profile?.ativo) {
      await supabase.auth.signOut();
      return supabaseResponse;
    }
    if (profile.perfil === 'superadmin') destination = '/admin/clientes';
    if (profile.cliente_id) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('status')
        .eq('id', profile.cliente_id)
        .maybeSingle();
      if (cliente?.status === 'suspenso') destination = '/admin/suspenso';
    }
    const redirectResponse = NextResponse.redirect(new URL(destination, request.url));
    supabaseResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirectResponse;
  }

  if (user && isSuspendedPage) return supabaseResponse;

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
