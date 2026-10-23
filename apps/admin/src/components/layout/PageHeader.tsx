import { ReactNode } from 'react';

interface PageHeaderProps {
  /** Rótulo em caixa alta acima do título — para heróis de detalhe (ex.: "Item não conforme"). */
  kicker?: ReactNode;
  /** Nome da tela — a mesma palavra usada no menu. */
  title: string;
  /** Uma frase dizendo para que serve a tela e qual é o próximo passo. */
  description?: string;
  /** Ações da página; a primária vem por último, em Azul Prumo. Também usado para selos de status em heróis de detalhe. */
  actions?: ReactNode;
  /** Faixa de abas ou qualquer recorte que pertença ao cabeçalho. */
  children?: ReactNode;
}

/**
 * Cabeçalho padrão de toda tela do painel: título, descrição, ações e — quando
 * houver — a faixa de abas. Mantém título e ação primária sempre na mesma posição.
 */
export default function PageHeader({ kicker, title, description, actions, children }: PageHeaderProps) {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="min-w-0">
          {kicker ? <p className="prumo-kicker mb-2 text-[var(--prumo-brand)]">{kicker}</p> : null}
          <h1 className="text-xl font-semibold tracking-[-0.025em] text-txt">{title}</h1>
          {description ? <p className="mt-1.5 max-w-[660px] text-sm text-txt-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
