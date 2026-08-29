'use client';

import { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  width?: string;
  /** Números e ações alinham à direita; texto fica à esquerda. */
  align?: 'left' | 'right';
  className?: string; // Optional custom classes for table cell
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  /** Frase curta explicando quando a lista deixa de estar vazia. */
  emptyHint?: string;
  /** Ação sugerida no estado vazio (ex.: "Ver vistorias da obra"). */
  emptyAction?: ReactNode;
  /** Rodapé da tabela — paginação ou totais. */
  footer?: ReactNode;
  rowKey?: (item: T) => string;
}

export default function DataTable<T>({
  data,
  columns,
  loading = false,
  onRowClick,
  emptyMessage = 'Nenhum registro encontrado.',
  emptyHint,
  emptyAction,
  footer,
  rowKey,
}: DataTableProps<T>) {

  if (loading) {
    return (
      <div className="prumo-panel w-full overflow-hidden">
        <div className="flex animate-pulse flex-col">
          <div className="h-9 border-b border-brd-0 bg-bg-0"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex h-[52px] items-center border-b border-brd-0 px-4">
              <div className="h-3.5 w-full rounded bg-bg-2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="prumo-panel flex w-full flex-col items-center justify-center px-6 py-12 text-center">
        <div className="mb-4 h-8 w-px bg-accent" />
        <p className="text-sm font-semibold text-txt">{emptyMessage}</p>
        {emptyHint ? <p className="mt-1.5 max-w-[320px] text-[13px] text-txt-2">{emptyHint}</p> : null}
        {emptyAction ? <div className="mt-4">{emptyAction}</div> : null}
      </div>
    );
  }

  return (
    <div className="prumo-panel w-full overflow-hidden">
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-brd-0 bg-bg-0">
              {columns.map((col, idx) => (
                <th
                  key={col.header || idx}
                  className={`whitespace-nowrap px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.4px] text-txt-2 ${
                    col.align === 'right' ? 'text-right' : ''
                  } ${col.width || ''}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((item, rowIdx) => {
              const rowIsClickable = !!onRowClick;
              return (
                <tr
                  key={rowKey ? rowKey(item) : rowIdx}
                  onClick={() => rowIsClickable && onRowClick(item)}
                  onKeyDown={event => {
                    if (rowIsClickable && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onRowClick(item);
                    }
                  }}
                  tabIndex={rowIsClickable ? 0 : undefined}
                  className={`border-b border-brd-0 last:border-0 ${
                    rowIsClickable
                      ? 'cursor-pointer transition-colors hover:bg-accent-soft/50 focus:bg-accent-soft/50 focus:outline-none'
                      : ''
                  }`}
                >
                  {columns.map((col, colIdx) => (
                    <td
                      key={colIdx}
                      className={`px-4 py-3 text-[13px] text-txt ${col.align === 'right' ? 'text-right' : ''} ${
                        col.className || ''
                      }`}
                    >
                      {col.cell
                        ? col.cell(item)
                        : col.accessorKey ? String(item[col.accessorKey as keyof T]) : null}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {footer ? <div className="border-t border-brd-0 px-4 py-2.5">{footer}</div> : null}
    </div>
  );
}
