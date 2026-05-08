import { formatInline } from './inline-format';

export function TableBlock({ rows }: { rows: string[] }) {
  if (rows.length < 2) return null;

  const headerCells = rows[0].split('|').filter((cell) => cell.trim() !== '').map((cell) => cell.trim());
  const bodyRows = rows.slice(2).map((row) =>
    row.split('|').filter((cell) => cell.trim() !== '').map((cell) => cell.trim()),
  );

  return (
    <div className="my-4 overflow-x-auto rounded-lg border border-gray-200 dark:border-white/10">
      <table className="min-w-full text-sm text-left">
        <thead className="bg-gray-100 dark:bg-white/5 text-gray-700 dark:text-gray-200">
          <tr>
            {headerCells.map((header, index) => (
              <th key={index} className="px-4 py-3 font-semibold border-b border-gray-200 dark:border-white/10 whitespace-nowrap">
                {formatInline(header)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-[#1E1E1E] divide-y divide-gray-200 dark:divide-white/5">
          {bodyRows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2.5 text-gray-700 dark:text-gray-400 border-r border-gray-200 dark:border-white/5 last:border-r-0">
                  {formatInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
