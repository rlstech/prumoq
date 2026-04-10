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
      <div className="w-full bg-bg-1 border border-brd-0 rounded-xl overflow-hidden">
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
      <div className="w-full bg-bg-1 border border-brd-0 rounded-xl flex flex-col items-center justify-center p-12">
        <p className="text-txt-3 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="w-full bg-bg-1 border border-brd-0 rounded-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-bg-0 border-b border-brd-0">
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
                className={`
                  border-b border-brd-0 last:border-0 
                  ${rowIsClickable ? 'cursor-pointer hover:bg-bg-2 transition-colors' : ''}
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
