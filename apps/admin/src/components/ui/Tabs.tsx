import { ReactNode } from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Rótulo acessível do grupo de abas (ex.: "Recortes de obras"). */
  ariaLabel?: string;
  /** Ação alinhada à direita, na mesma linha das abas. */
  trailing?: ReactNode;
  /** `segmented`: seções da tela (uma pílula branca com abas). `chips`: filtros soltos, um por pílula. */
  variant?: 'segmented' | 'chips';
  /** Espaço acima do grupo (padrão: logo abaixo do cabeçalho da página). */
  className?: string;
}

/**
 * Recortes do mesmo conjunto de dados — abertas, em correção, resolvidas.
 * Seletor em pílula: a aba ativa fica grafite com a contagem em amarelo.
 */
export default function Tabs({ tabs, value, onChange, ariaLabel = 'Recortes', trailing, variant = 'segmented', className = 'mt-5' }: TabsProps) {
  const chips = variant === 'chips';
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <div
        className={`flex max-w-full items-center overflow-x-auto ${chips ? 'flex-wrap gap-2' : 'gap-1 rounded-full bg-bg-1 p-1'}`}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map(tab => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-colors ${
                active
                  ? 'bg-sidebar font-bold text-white'
                  : `font-semibold text-txt ${chips ? 'bg-bg-1 hover:bg-bg-2' : 'hover:bg-bg-0'}`
              }`}
            >
              {tab.label}
              {typeof tab.count === 'number' ? (
                <span className={`font-mono text-xs font-bold ${active ? 'text-accent' : 'text-txt-2'}`}>
                  {tab.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {trailing ? <div className="ml-auto flex shrink-0 items-center">{trailing}</div> : null}
    </div>
  );
}
