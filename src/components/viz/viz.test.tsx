// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BarChart from './BarChart';
import LineChart from './LineChart';
import Sparkline from './Sparkline';
import HBarStack from './HBarStack';
import MonthHeatStrip from './MonthHeatStrip';
import DeltaChip from './DeltaChip';
import { StatTile } from '@/components/StatTile';
import { CHART_SERIES, CHART_SEQUENTIAL } from './palette';

const tableLabels = { show: 'Show table', hide: 'Hide table' };

describe('viz palette', () => {
  it('matches the validated categorical set (doc 06 §3.5 — re-validate on change)', () => {
    expect([...CHART_SERIES]).toEqual(['#00937F', '#D69A3A', '#C05840', '#4477CC']);
  });

  it('sequential ramp has monotonically decreasing lightness (light→dark)', () => {
    const luminance = (hex: string) => {
      const n = parseInt(hex.slice(1), 16);
      return ((n >> 16) & 255) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114;
    };
    const ls = CHART_SEQUENTIAL.map(luminance);
    for (let i = 1; i < ls.length; i++) {
      expect(ls[i]).toBeLessThan(ls[i - 1]);
    }
  });
});

describe('DeltaChip', () => {
  it('shows an up arrow and percentage for an increase', () => {
    render(
      <DeltaChip currentValue={120} previousValue={100} vsLabel="vs last month" newLabel="New" />
    );
    expect(screen.getByText('▲')).toBeInTheDocument();
    expect(screen.getByText(/\+20%/)).toBeInTheDocument();
  });

  it('shows a down arrow for a decrease', () => {
    render(
      <DeltaChip currentValue={50} previousValue={100} vsLabel="vs last month" newLabel="New" />
    );
    expect(screen.getByText('▼')).toBeInTheDocument();
    expect(screen.getByText(/-50%/)).toBeInTheDocument();
  });

  it('shows the new-label when there is no prior period', () => {
    render(
      <DeltaChip currentValue={10} previousValue={null} vsLabel="vs last month" newLabel="New" />
    );
    expect(screen.getByText('New')).toBeInTheDocument();
  });
});

describe('Sparkline', () => {
  it('renders a polyline and an accessible title', () => {
    const { container } = render(
      <Sparkline values={[0, 1, 0.5, 1]} title="Occupancy, last 4 days" max={1} />
    );
    expect(container.querySelector('polyline')).not.toBeNull();
    expect(screen.getByRole('img', { name: 'Occupancy, last 4 days' })).toBeInTheDocument();
  });

  it('renders a dashed placeholder with no data', () => {
    const { container } = render(<Sparkline values={[]} title="No data" />);
    expect(container.querySelector('polyline')).toBeNull();
    expect(container.querySelector('line')).not.toBeNull();
  });
});

describe('BarChart', () => {
  const data = [
    { label: 'Jan', value: 100 },
    { label: 'Feb', value: 250 },
    { label: 'Mar', value: 180 },
  ];

  it('renders one bar path per non-zero datum and axis labels', () => {
    const { container } = render(
      <BarChart
        data={data}
        valueHeader="Revenue"
        labelHeader="Month"
        tableToggleLabels={tableLabels}
        emptyLabel="No data yet"
      />
    );
    expect(container.querySelectorAll('path').length).toBe(3);
    expect(screen.getByText('Jan')).toBeInTheDocument();
  });

  it('toggles the accessible table view', () => {
    render(
      <BarChart
        data={data}
        valueHeader="Revenue"
        labelHeader="Month"
        tableToggleLabels={tableLabels}
        emptyLabel="No data yet"
      />
    );
    fireEvent.click(screen.getByText('Show table'));
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Hide table')).toBeInTheDocument();
  });

  it('renders the empty label with no data', () => {
    render(
      <BarChart
        data={[]}
        valueHeader="Revenue"
        labelHeader="Month"
        tableToggleLabels={tableLabels}
        emptyLabel="No data yet"
      />
    );
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });
});

describe('LineChart', () => {
  it('renders the series line and table toggle', () => {
    const { container } = render(
      <LineChart
        data={[
          { label: 'Jan', value: 40 },
          { label: 'Feb', value: 80 },
        ]}
        max={100}
        valueHeader="Occupancy"
        labelHeader="Month"
        tableToggleLabels={tableLabels}
        emptyLabel="No data yet"
      />
    );
    expect(container.querySelector('polyline')).not.toBeNull();
    fireEvent.click(screen.getByText('Show table'));
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});

describe('HBarStack', () => {
  it('renders rows with a legend for multi-segment bars', () => {
    render(
      <HBarStack
        rows={[
          {
            label: 'Villa A',
            segments: [
              { key: 'net', label: 'Owner share', value: 900, color: '#00937F' },
              { key: 'fee', label: 'Platform fee', value: 100, color: '#D69A3A' },
            ],
          },
        ]}
        legendLabels={[
          { label: 'Owner share', color: '#00937F' },
          { label: 'Platform fee', color: '#D69A3A' },
        ]}
        valueHeader="Amount"
        labelHeader="Unit"
        tableToggleLabels={tableLabels}
        emptyLabel="No data yet"
      />
    );
    expect(screen.getAllByText('Owner share').length).toBeGreaterThan(0);
    expect(screen.getByText('Villa A')).toBeInTheDocument();
    expect(screen.getByText('1000')).toBeInTheDocument(); // row total
  });
});

describe('MonthHeatStrip', () => {
  it('renders one cell per day with state titles', () => {
    const { container } = render(
      <MonthHeatStrip
        days={[
          { date: '2026-07-01', occupied: true },
          { date: '2026-07-02', occupied: false },
          { date: '2026-07-03', occupied: null },
        ]}
        occupiedLabel="Occupied"
        vacantLabel="Vacant"
        noDataLabel="No data"
      />
    );
    expect(container.querySelectorAll('rect').length).toBe(3);
    expect(container.textContent).toContain('2026-07-01 · Occupied');
    expect(container.textContent).toContain('2026-07-03 · No data');
  });
});

describe('StatTile', () => {
  it('renders label, value, and the delta slot', () => {
    render(
      <StatTile
        label="Revenue This Month"
        value="฿12,000"
        variant="revenue"
        delta={<DeltaChip currentValue={12000} previousValue={10000} vsLabel="vs last month" newLabel="New" />}
      />
    );
    expect(screen.getByText('Revenue This Month')).toBeInTheDocument();
    expect(screen.getByText('฿12,000')).toBeInTheDocument();
    expect(screen.getByText(/\+20%/)).toBeInTheDocument();
  });
});
