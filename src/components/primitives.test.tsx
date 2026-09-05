import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Chip } from './Chip';
import { ConfirmDialog } from './ConfirmDialog';
import { Counter } from './Counter';
import { DataTable } from './DataTable';
import { PriceBreakdown } from './PriceBreakdown';
import { Select } from './Select';
import { SkeletonBlock } from './SkeletonBlock';
import { StatusTimeline } from './StatusTimeline';
import { Switch } from './ChoiceControls';
import { Textarea } from './Textarea';

describe('Chip closed and checked_in', () => {
  it('maps closed to stone on paper', () => {
    render(
      <Chip variant="status" status="closed">
        Closed
      </Chip>
    );
    const chip = screen.getByText('Closed').closest('div');
    expect(chip).toHaveClass('text-text-stone');
  });

  it('maps checked_in to info tokens', () => {
    render(
      <Chip variant="status" status="checked_in">
        Checked in
      </Chip>
    );
    const chip = screen.getByText('Checked in').closest('div');
    expect(chip).toHaveClass('bg-state-info-soft');
    expect(chip).toHaveClass('text-state-info');
  });
});

describe('Textarea', () => {
  it('renders label and value', async () => {
    render(<Textarea label="Note" defaultValue="Gate code" />);
    expect(screen.getByLabelText('Note')).toHaveValue('Gate code');
  });
});

describe('Select', () => {
  it('renders options', () => {
    render(
      <Select
        label="Project"
        defaultValue="layan"
        options={[
          { value: 'layan', label: 'Layan' },
          { value: 'bangtao', label: 'Bang Tao' },
        ]}
      />
    );
    expect(screen.getByLabelText('Project')).toHaveValue('layan');
    expect(screen.getByRole('option', { name: 'Bang Tao' })).toBeInTheDocument();
  });
});

describe('Counter', () => {
  it('steps within bounds', async () => {
    const onChange = vi.fn();
    render(
      <Counter
        value={2}
        onChange={onChange}
        min={1}
        max={3}
        decreaseLabel="Fewer"
        increaseLabel="More"
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(onChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: 'Fewer' }));
    expect(onChange).toHaveBeenCalledWith(1);
  });
});

describe('Switch', () => {
  it('toggles checked state', async () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} label="Notify" />);
    await userEvent.click(screen.getByRole('switch', { name: 'Notify' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});

describe('ConfirmDialog', () => {
  it('requires typed confirmation before confirm', async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Cancel booking?"
        consequences={['The unit is released.']}
        cancelLabel="Keep"
        confirmLabel="Cancel"
        typedConfirmation={{ phrase: 'CANCEL', prompt: 'Type CANCEL' }}
        onCancel={() => undefined}
        onConfirm={onConfirm}
      />
    );
    const confirm = screen.getByRole('button', { name: 'Cancel' });
    expect(confirm).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Type CANCEL'), 'CANCEL');
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

describe('StatusTimeline', () => {
  it('renders event titles in order', () => {
    render(
      <StatusTimeline
        events={[
          { id: '1', title: 'Resolved', detail: 'done' },
          { id: '2', title: 'Raised', detail: 'opened' },
        ]}
      />
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Resolved');
    expect(items[1]).toHaveTextContent('Raised');
  });
});

describe('PriceBreakdown', () => {
  it('totals satang lines through MoneyAmount', () => {
    render(
      <PriceBreakdown
        totalLabel="Total"
        lines={[
          { id: 'a', label: 'Nights', satang: 3_600_000 },
          { id: 'b', label: 'Credit', satang: -120_000 },
        ]}
      />
    );
    expect(screen.getByText('฿36,000')).toBeInTheDocument();
    expect(screen.getByText('−฿1,200')).toBeInTheDocument();
    expect(screen.getByText('฿34,800')).toBeInTheDocument();
  });
});

describe('DataTable', () => {
  it('sorts by header and collapses to definition lists on the same data', async () => {
    render(
      <DataTable
        rowKey={(row) => row.id}
        columns={[
          { key: 'unit', header: 'Unit' },
          { key: 'amount', header: 'Amount', numeric: true, sortValue: (row) => row.satang },
        ]}
        rows={[
          { id: '1', unit: 'B-707', amount: '฿36,600', satang: 36600 },
          { id: '2', unit: 'A-204', amount: '฿18,400', satang: 18400 },
        ]}
      />
    );
    expect(screen.getAllByText('B-707').length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('button', { name: 'Amount' }));
    expect(screen.getByRole('button', { name: /Amount/ })).toHaveTextContent('↑');
  });
});

describe('SkeletonBlock', () => {
  it('uses the 1.2s pulse token class', () => {
    const { container } = render(<SkeletonBlock shape="card" />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });
});
