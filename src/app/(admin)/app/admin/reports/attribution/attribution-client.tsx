'use client';

import { useCallback, useEffect, useState } from 'react';

interface MetricRow {
  channelId: string;
  channelName: string;
  channelCategory: string;
  profileCount: number;
  ownerCount: number;
  guestCount: number;
  buyerCount: number;
  conversionRate: {
    toOwner: string;
    toGuest: string;
    toBuyer: string;
  };
}

type Labels = Record<string, string>;

export default function AdminAttributionClient({ labels }: { labels: Labels }) {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [summary, setSummary] = useState({ totalProfiles: 0, activeChannels: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/reports/attribution');
      if (!response.ok) throw new Error(labels['admin.attribution.error']);
      const data = await response.json();
      setMetrics(Array.isArray(data.metrics) ? data.metrics : []);
      setSummary({
        totalProfiles: data.summary?.totalProfiles ?? 0,
        activeChannels: data.summary?.activeChannels ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : labels['admin.attribution.error']);
      setMetrics([]);
    } finally {
      setLoading(false);
    }
  }, [labels]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-body text-text-secondary">{labels['admin.attribution.loading']}</p>;
  }

  if (error) {
    return (
      <p className="text-small text-state-error" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-24">
      <div className="flex gap-24 text-body">
        <p>
          <span className="text-text-secondary">{labels['admin.attribution.summary_profiles']}: </span>
          <span className="font-semibold">{summary.totalProfiles}</span>
        </p>
        <p>
          <span className="text-text-secondary">{labels['admin.attribution.summary_channels']}: </span>
          <span className="font-semibold">{summary.activeChannels}</span>
        </p>
      </div>

      {metrics.length === 0 ? (
        <p className="text-body text-text-secondary">{labels['admin.attribution.empty']}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="border-b border-border-line">
                <th className="px-12 py-12 text-left">{labels['admin.attribution.col_channel']}</th>
                <th className="px-12 py-12 text-left">{labels['admin.attribution.col_category']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.attribution.col_profiles']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.attribution.col_guests']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.attribution.col_buyers']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.attribution.col_owners']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.attribution.col_conv_guest']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.attribution.col_conv_buyer']}</th>
                <th className="px-12 py-12 text-right">{labels['admin.attribution.col_conv_owner']}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.channelId} className="border-b border-border-line">
                  <td className="px-12 py-8">{m.channelName}</td>
                  <td className="px-12 py-8">{m.channelCategory}</td>
                  <td className="px-12 py-8 text-right font-mono">{m.profileCount}</td>
                  <td className="px-12 py-8 text-right font-mono">{m.guestCount}</td>
                  <td className="px-12 py-8 text-right font-mono">{m.buyerCount}</td>
                  <td className="px-12 py-8 text-right font-mono">{m.ownerCount}</td>
                  <td className="px-12 py-8 text-right">{m.conversionRate.toGuest}%</td>
                  <td className="px-12 py-8 text-right">{m.conversionRate.toBuyer}%</td>
                  <td className="px-12 py-8 text-right">{m.conversionRate.toOwner}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
