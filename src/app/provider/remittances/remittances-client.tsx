'use client';

type Labels = Record<string, string>;

interface RemittanceFigures {
  fulfilledOrdersTotal: number;
  takeRateThb: number;
  refundsClawedBack: number;
  netThb: number;
  orderCount: number;
  refundCount: number;
}

interface PayoutRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  amountThb: number;
  reference: string;
  executedOn: string;
  status: string;
}

const CADENCE_KEY: Record<string, string> = {
  weekly: 'provider.remittances.cadence_weekly',
  biweekly: 'provider.remittances.cadence_biweekly',
  monthly: 'provider.remittances.cadence_monthly',
};

const STATUS_TONE: Record<string, string> = {
  recorded: 'provider.remittances.status_recorded',
  reconciled: 'provider.remittances.status_reconciled',
};

const NET_TONE = 'text-brand-andaman';

function formatBaht(satang: number) {
  return (satang / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function formatPeriod(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  e.setUTCDate(e.getUTCDate() - 1);
  return `${s.toLocaleDateString()} — ${e.toLocaleDateString()}`;
}

function FigureRow({
  label,
  value,
  tone = 'text-text-ink',
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex justify-between gap-16 py-8 border-b border-border-line last:border-b-0">
      <span className="text-body text-text-secondary">{label}</span>
      <span className={`text-body font-semibold tabular-nums ${tone}`}>฿{value}</span>
    </div>
  );
}

export default function ProviderRemittancesClient({
  cadence,
  currentPeriod,
  payouts,
  labels,
}: {
  cadence: string;
  currentPeriod: {
    periodStart: string;
    periodEnd: string;
    remittance: RemittanceFigures;
    payoutRecorded: boolean;
    payoutId: string | null;
  };
  payouts: PayoutRow[];
  labels: Labels;
}) {
  const cadenceLabel = labels[CADENCE_KEY[cadence] ?? CADENCE_KEY.weekly];
  const remittance = currentPeriod.remittance;

  return (
    <div className="space-y-24">
      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-12 mb-16">
          <div>
            <h2 className="text-heading-3 font-bold text-text-ink mb-4">
              {labels['provider.remittances.current_period']}
            </h2>
            <p className="text-body text-text-secondary">
              {formatPeriod(currentPeriod.periodStart, currentPeriod.periodEnd)}
            </p>
            <p className="text-caption text-text-secondary mt-4">{cadenceLabel}</p>
          </div>
          <span
            className={`inline-flex self-start px-12 py-4 rounded-full text-caption font-semibold ${
              currentPeriod.payoutRecorded
                ? 'bg-state-success-soft text-state-success'
                : 'bg-state-warning-soft text-state-warning'
            }`}
          >
            {currentPeriod.payoutRecorded
              ? labels['provider.remittances.payout_recorded']
              : labels['provider.remittances.payout_pending']}
          </span>
        </div>

        <FigureRow
          label={labels['provider.remittances.gross']}
          value={formatBaht(remittance.fulfilledOrdersTotal)}
        />
        <FigureRow
          label={labels['provider.remittances.take_rate']}
          value={formatBaht(remittance.takeRateThb)}
        />
        <FigureRow
          label={labels['provider.remittances.refunds']}
          value={formatBaht(remittance.refundsClawedBack)}
        />
        <FigureRow
          label={labels['provider.remittances.net']}
          value={formatBaht(remittance.netThb)}
          tone={NET_TONE}
        />

        <p className="text-caption text-text-secondary mt-16">
          {labels['provider.remittances.order_count'].replace(
            '{count}',
            String(remittance.orderCount)
          )}
          {remittance.refundCount > 0
            ? ` · ${labels['provider.remittances.refund_count'].replace(
                '{count}',
                String(remittance.refundCount)
              )}`
            : ''}
        </p>
      </section>

      <section className="bg-surface-paper border border-border-line rounded-lg p-24">
        <h2 className="text-heading-3 font-bold text-text-ink mb-16">
          {labels['provider.remittances.history_title']}
        </h2>

        {payouts.length === 0 ? (
          <p className="text-body text-text-secondary">
            {labels['provider.remittances.history_empty']}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border-line">
                  <th className="text-caption font-semibold text-text-secondary pb-8 pr-16">
                    {labels['provider.remittances.period']}
                  </th>
                  <th className="text-caption font-semibold text-text-secondary pb-8 pr-16">
                    {labels['provider.remittances.amount']}
                  </th>
                  <th className="text-caption font-semibold text-text-secondary pb-8 pr-16">
                    {labels['provider.remittances.executed_on']}
                  </th>
                  <th className="text-caption font-semibold text-text-secondary pb-8 pr-16">
                    {labels['provider.remittances.reference']}
                  </th>
                  <th className="text-caption font-semibold text-text-secondary pb-8">
                    {labels['provider.remittances.status']}
                  </th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id} className="border-b border-border-line last:border-b-0">
                    <td className="text-body py-12 pr-16 whitespace-nowrap">
                      {payout.periodStart && payout.periodEnd
                        ? formatPeriod(payout.periodStart, payout.periodEnd)
                        : '—'}
                    </td>
                    <td className="text-body font-semibold tabular-nums py-12 pr-16">
                      ฿{formatBaht(payout.amountThb)}
                    </td>
                    <td className="text-body py-12 pr-16 whitespace-nowrap">
                      {new Date(payout.executedOn).toLocaleDateString()}
                    </td>
                    <td className="text-body py-12 pr-16">{payout.reference}</td>
                    <td className="text-body py-12">
                      {labels[STATUS_TONE[payout.status] ?? payout.status] ?? payout.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
