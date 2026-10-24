import { ReactNode } from 'react';

interface PageHeaderProps {
  /** Rótulo em caixa alta acima do título — para heróis de detalhe (ex.: "Item não conforme"). */
  kicker?: ReactNode;
  /** Nome da tela — a mesma palavra usada no menu. */
  title: string;
  /** Uma frase dizendo para que serve a tela e qual é o próximo passo. */
  description?: string;
  /** Ações da página; a primária vem por último, em amarelo. Também usado para selos de status em heróis de detalhe. */
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          {kicker ? <p className="prumo-kicker mb-1.5">{kicker}</p> : null}
          <h1 className="text-[30px] font-extrabold leading-[1.08] tracking-[-0.03em] text-txt md:text-[36px]">{title}</h1>
          {description ? <p className="mt-2 max-w-[660px] text-[15px] text-txt-2">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}
