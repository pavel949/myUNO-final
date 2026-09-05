import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DataTable } from './DataTable';

interface Row {
  id: string;
  unit: string;
  guest: string;
}

const rows: Row[] = [
  { id: '1', unit: 'B-707 · Layan', guest: 'A. Sokolova' },
  { id: '2', unit: 'A-204 · Bang Tao', guest: 'M. Chen' },
];

describe('DataTable', () => {
  it('renders the desktop table and the mobile card list with the same data', () => {
    render(
      <DataTable
        rowKey={(r) => r.id}
        columns={[
          { key: 'unit', header: 'Unit', render: (r) => r.unit },
          { key: 'guest', header: 'Guest', render: (r) => r.guest },
        ]}
        rows={rows}
      />
    );

    // Each cell renders twice — once in the table, once in the mobile card —
    // and CSS (not React) decides which is visible at a given width.
    expect(screen.getAllByText('B-707 · Layan')).toHaveLength(2);
    expect(screen.getAllByText('A. Sokolova')).toHaveLength(2);
    expect(screen.getAllByText('Unit').length).toBeGreaterThan(0);
  });
});
