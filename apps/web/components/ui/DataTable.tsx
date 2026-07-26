'use client';

import { ReactNode } from 'react';

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (item: T) => ReactNode;
  width?: string;
  className?: string; // Optional custom classes for table cell
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  rowKey?: (item: T) => string;
}

export default function DataTable<T>({ 
  data, 
  columns, 
  loading = false, 
  onRowClick,
  emptyMessage = "Nenhum registro encontrado.",
  rowKey
}: DataTableProps<T>) {

  if (loading) {
    return (
      <div className="prumo-panel w-full overflow-hidden">
        <div className="animate-pulse flex flex-col">
          <div className="h-10 bg-bg-2 border-b border-brd-0"></div>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-14 flex items-center px-4 border-b border-brd-0">
              <div className="h-4 bg-bg-2 rounded w-full"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="prumo-panel flex w-full flex-col items-center justify-center p-12">
        <div className="mb-4 h-8 w-px bg-accent" />
        <p className="text-sm text-txt-3">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="prumo-panel w-full overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-brd-0 bg-bg-0">
            {columns.map((col, idx) => (
              <th 
                key={col.header || idx} 
                className={`py-3 px-4 text-[11px] font-semibold text-txt-2 tracking-[0.4px] uppercase whitespace-nowrap ${col.width || ''}`}
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
                className={`
                  border-b border-brd-0 last:border-0 
                  ${rowIsClickable ? 'cursor-pointer hover:bg-accent-soft/50 focus:bg-accent-soft/50 focus:outline-none transition-colors' : ''}
                `}
              >
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className={`py-3 px-4 text-sm text-txt ${col.className || ''}`}>
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
  );
}
