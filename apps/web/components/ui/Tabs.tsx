'use client';

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
}

/**
 * Recortes do mesmo conjunto de dados — abertas, em correção, resolvidas.
 * Substituem filtros escondidos que ninguém abre.
 */
export default function Tabs({ tabs, value, onChange, ariaLabel = 'Recortes', trailing }: TabsProps) {
  return (
    <div className="mt-4 flex items-center gap-0.5 overflow-x-auto border-b border-brd-0" role="tablist" aria-label={ariaLabel}>
      {tabs.map(tab => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`-mb-px flex h-[38px] shrink-0 items-center gap-2 border-b-2 px-3 text-[13px] transition-colors ${
              active
                ? 'border-[var(--br)] font-semibold text-txt'
                : 'border-transparent font-normal text-txt-3 hover:text-txt'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' ? (
              <span
                className={`rounded-full px-1.5 py-px font-mono text-[10.5px] font-semibold ${
                  active ? 'bg-[var(--br)] text-white' : 'bg-na-bg text-na'
                }`}
              >
                {tab.count}
              </span>
            ) : null}
          </button>
        );
      })}
      {trailing ? <div className="ml-auto flex shrink-0 items-center pb-1.5 pl-3">{trailing}</div> : null}
    </div>
  );
}
