/**
 * ChartTable — the accessible twin of every chart (the relief rule for the
 * gold series slot and the general table-view guarantee). Rendered by the
 * chart components behind their "view as table" toggle.
 */
export default function ChartTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto mt-8">
      <table className="w-full text-small">
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left font-semibold text-text-secondary py-4 pr-16 border-b border-border-line"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={`py-4 pr-16 border-b border-border-line text-text-ink ${
                    j > 0 ? 'tabular-nums' : ''
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
