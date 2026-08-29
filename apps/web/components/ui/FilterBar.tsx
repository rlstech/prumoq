'use client';

import { ReactNode } from 'react';
import { Search } from 'lucide-react';

interface FilterBarProps {
  children: ReactNode;
  /** Contagem de resultados, sempre no canto direito da barra. */
  resultLabel?: string;
}

/**
 * Barra de filtros padrão: busca à esquerda, recortes no meio, total à direita —
 * na mesma posição em todas as telas de lista.
 */
export function FilterBar({ children, resultLabel }: FilterBarProps) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
      {children}
      {resultLabel ? <div className="ml-auto text-xs text-txt-3">{resultLabel}</div> : null}
    </div>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function SearchField({ value, onChange, placeholder = 'Buscar', className = 'w-full sm:w-[268px]' }: SearchFieldProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-txt-3" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="prumo-field h-9 min-h-9 pl-9"
      />
    </div>
  );
}

interface SelectFilterProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function SelectFilter({ label, value, onChange, options }: SelectFilterProps) {
  return (
    <label className="flex h-9 items-center gap-2 rounded border border-[var(--brd1)] bg-bg-1 pl-3 pr-1 text-[13px]">
      <span className="whitespace-nowrap text-txt-3">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-full max-w-[180px] cursor-pointer border-0 bg-transparent pr-1 text-[13px] font-medium text-txt outline-none"
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
