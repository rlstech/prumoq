// Mesma API do `next/link` usada no painel (href relativo a /admin), sobre o Link do React Router.
import type { AnchorHTMLAttributes } from 'react';
import { Link as RouterLink } from 'react-router';

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string;
  replace?: boolean;
  /** Aceitos por compatibilidade com o Next; sem efeito aqui. */
  prefetch?: boolean;
  scroll?: boolean;
};

export default function Link({ href, replace, prefetch: _prefetch, scroll: _scroll, ...rest }: LinkProps) {
  return <RouterLink to={href} replace={replace} {...rest} />;
}
