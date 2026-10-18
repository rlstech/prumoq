import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createDataClient, memoizeToken, NEON_TOKEN_TEMPLATE } from '@/lib/neon/data-client';

export default clerkMiddleware(async (auth, request) => {
  const { userId, getToken } = await auth();

  const { pathname, searchParams } = request.nextUrl;
  // With basePath '/admin', Next.js strips the prefix before middleware sees it.
  // pathname is '/login', '/dashboard', etc. — not '/admin/login'.
  const isLoginPage = pathname === '/login';
  const isProtected =
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/suspenso') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/favicon');

  if (!userId && isProtected) {
    return NextResponse.redirect(new URL('/admin/login', request.url));
  }

  // `?sair=1`: a tela de login encerra a sessão do Clerk no navegador (o servidor não consegue).
  // Sem esta exceção, um usuário inativo cairia num laço login -> login.
  if (userId && isLoginPage && searchParams.get('sair') !== '1') {
    const supabase = createDataClient(memoizeToken(() => getToken({ template: NEON_TOKEN_TEMPLATE })));
    const { data: profile } = await supabase
      .from('usuarios')
      .select('perfil, cliente_id, ativo')
      .eq('clerk_user_id', userId)
      .maybeSingle();
    // Só encerra a sessão quando o banco CONFIRMA que o usuário está inativo. Perfil ausente (consulta vazia
    // por cold start da Data API, ou conta ainda sem linha em `usuarios`) não pode deslogar ninguém.
    if (profile && !profile.ativo) {
      return NextResponse.redirect(new URL('/admin/login?sair=1&motivo=inativo', request.url));
    }
    // Inspetor usa só o mobile. Sem isto, login -> dashboard -> (layout barra inspetor) -> login vira laço.
    if (profile?.perfil === 'inspetor') {
      return NextResponse.redirect(new URL('/admin/login?sair=1&motivo=inspetor', request.url));
    }
    if (!profile) return NextResponse.next();
    let destination = '/admin/dashboard';
    if (profile.perfil === 'superadmin') destination = '/admin/clientes';
    if (profile.cliente_id) {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('status')
        .eq('id', profile.cliente_id)
        .maybeSingle();
      if (cliente?.status === 'suspenso') destination = '/admin/suspenso';
    }
    return NextResponse.redirect(new URL(destination, request.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
