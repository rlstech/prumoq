import { ReactNode } from 'react';
import { Search } from '@/components/icons';

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
    <div className="mb-3.5 flex flex-wrap items-center gap-2">
      {children}
      {resultLabel ? <div className="ml-auto px-1 text-[13px] text-txt-2">{resultLabel}</div> : null}
    </div>
  );
}

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Busca em pílula branca sobre o concreto. */
export function SearchField({ value, onChange, placeholder = 'Buscar', className = 'w-full sm:w-[300px]' }: SearchFieldProps) {
  return (
    <div className={`relative ${className}`}>
      <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-txt-2" aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={event => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-11 w-full rounded-full bg-bg-1 pl-11 pr-4 text-sm text-txt outline-none transition-shadow placeholder:text-txt-3 focus:shadow-[0_0_0_2px_#1C1F22,0_0_0_6px_rgba(255,194,26,.5)]"
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
    <label className="flex h-11 items-center gap-1.5 rounded-full bg-bg-1 pl-[18px] pr-2 text-sm focus-within:shadow-[0_0_0_2px_#1C1F22,0_0_0_6px_rgba(255,194,26,.5)]">
      <span className="whitespace-nowrap text-txt-2">{label}</span>
      <select
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-full max-w-[200px] cursor-pointer border-0 bg-transparent pr-1 text-sm font-bold text-txt outline-none"
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
