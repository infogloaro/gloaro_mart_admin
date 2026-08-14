import type { ReactNode } from 'react';
import { Icon } from './Icon';

export interface Column<T> {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  keyFor: (row: T) => string | number;
  emptyMessage?: string;
}

function EmptyState({ message, tone = 'neutral' }: { message: string; tone?: 'neutral' | 'error' }) {
  const error = tone === 'error';
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          error ? 'bg-rose-50 text-rose-500' : 'bg-mint-mist text-emerald'
        }`}
      >
        <Icon name={error ? 'alert' : 'box'} className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium text-slate-500">{message}</p>
    </div>
  );
}

export function DataTable<T>({ columns, rows, keyFor, emptyMessage = 'No records found.' }: DataTableProps<T>) {
  // A malformed response should not take the whole admin down with it.
  if (!Array.isArray(rows)) {
    return <EmptyState message="Unexpected response from the server." tone="error" />;
  }
  if (rows.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80 text-left">
            {columns.map((c) => (
              <th
                key={c.header}
                className="px-4 py-2.5 text-[10px] font-bold tracking-[0.08em] whitespace-nowrap text-slate-500 uppercase"
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {rows.map((row) => (
            <tr
              key={keyFor(row)}
              className="transition-colors duration-150 hover:bg-mint-mist/45"
            >
              {columns.map((c) => (
                <td key={c.header} className={`px-4 py-3 ${c.className ?? ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
