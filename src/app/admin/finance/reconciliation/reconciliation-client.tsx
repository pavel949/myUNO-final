'use client'

import { useEffect, useState } from 'react'

interface ReconciliationData {
  unmatchedPayments: any[]
  failedRefunds: any[]
  pendingPayouts: any[]
}

export default function ReconciliationClient({ labels }: { labels: Record<string, string> }) {
  const [data, setData] = useState<ReconciliationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const response = await fetch('/api/admin/finance/reconciliation')
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }
        const data = await response.json()
        setData(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch reconciliation data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const [reconciling, setReconciling] = useState<string | null>(null)
  const [resolving, setResolving] = useState<string | null>(null)

  const handleReconcilePayout = async (payoutId: string) => {
    try {
      setReconciling(payoutId)
      await fetch(`/api/admin/payouts/${payoutId}/reconcile`, { method: 'PUT' })
      // Refresh data
      const response = await fetch('/api/admin/finance/reconciliation')
      const newData = await response.json()
      setData(newData)
    } finally {
      setReconciling(null)
    }
  }

  const handleResolveRefund = async (refundId: string, action: 'retry' | 'write_off') => {
    try {
      setResolving(refundId)
      await fetch(`/api/admin/finance/refunds/${refundId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      // Refresh data
      const response = await fetch('/api/admin/finance/reconciliation')
      const newData = await response.json()
      setData(newData)
    } finally {
      setResolving(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{labels['finance.reconciliation.title']}</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-gray-600">{labels['finance.reconciliation.loading']}</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{labels['finance.reconciliation.title']}</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="text-red-900 font-medium">{labels['finance.reconciliation.error_title']}</div>
          <div className="text-red-700 mt-2">{error}</div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">{labels['finance.reconciliation.title']}</h1>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-gray-600">{labels['finance.reconciliation.no_data']}</div>
        </div>
      </div>
    )
  }

  const totalUnmatched = data.unmatchedPayments.length
  const totalFailedRefunds = data.failedRefunds.length
  const totalPendingPayouts = data.pendingPayouts.length

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{labels['finance.reconciliation.title']}</h1>
        <p className="text-gray-600 mt-2">{labels['finance.reconciliation.description']}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="text-sm font-medium text-orange-900">{labels['finance.reconciliation.unmatched_payments']}</div>
          <div className="text-3xl font-bold text-orange-600 mt-2">{totalUnmatched}</div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="text-sm font-medium text-red-900">{labels['finance.reconciliation.failed_refunds']}</div>
          <div className="text-3xl font-bold text-red-600 mt-2">{totalFailedRefunds}</div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="text-sm font-medium text-blue-900">{labels['finance.reconciliation.pending_payouts']}</div>
          <div className="text-3xl font-bold text-blue-600 mt-2">{totalPendingPayouts}</div>
        </div>
      </div>

      {/* Unmatched Payments Section */}
      {totalUnmatched > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-orange-500"></span>
            {`${labels['finance.reconciliation.unmatched_payments']} (${totalUnmatched})`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_amount']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_method']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_purpose']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_payer']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_status']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_created']}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.unmatchedPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">{`฿${payment.amountThb.toLocaleString()}`}</td>
                    <td className="px-4 py-3 capitalize">{payment.method}</td>
                    <td className="px-4 py-3 capitalize">{payment.purpose}</td>
                    <td className="px-4 py-3">{payment.payer}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        payment.status === 'failed' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {payment.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{new Date(payment.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Failed Refunds Section */}
      {totalFailedRefunds > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>
            {`${labels['finance.reconciliation.failed_refunds']} (${totalFailedRefunds})`}
          </h2>
          <div className="space-y-4">
            {data.failedRefunds.map((refund) => (
              <div key={refund.id} className="border border-red-200 rounded-lg p-4 bg-red-50">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="text-sm text-gray-600">{labels['finance.reconciliation.refund_amount']}</div>
                    <div className="text-lg font-bold">{`฿${refund.refundAmount.toLocaleString()}`}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{labels['finance.reconciliation.reason']}</div>
                    <div className="capitalize">{refund.reason}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{labels['finance.reconciliation.initiated_by']}</div>
                    <div>{refund.initiatedBy}</div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600">{labels['finance.reconciliation.col_created']}</div>
                    <div>{new Date(refund.createdAt).toLocaleDateString()}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleResolveRefund(refund.id, 'retry')}
                    disabled={resolving === refund.id}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  >
                    {labels['finance.reconciliation.retry_refund']}
                  </button>
                  <button
                    onClick={() => handleResolveRefund(refund.id, 'write_off')}
                    disabled={resolving === refund.id}
                    className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50"
                  >
                    {labels['finance.reconciliation.write_off']}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pending Payouts Section */}
      {totalPendingPayouts > 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-500"></span>
            {`${labels['finance.reconciliation.pending_payouts']} (${totalPendingPayouts})`}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_type']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_amount']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_reference']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_executed']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_recorded_by']}</th>
                  <th className="px-4 py-3 text-left font-medium">{labels['finance.reconciliation.col_status']}</th>
                  <th className="px-4 py-3 text-left">{labels['finance.reconciliation.col_action']}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.pendingPayouts.map((payout) => (
                  <tr key={payout.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium capitalize">{payout.payeeType}</td>
                    <td className="px-4 py-3 font-bold">{`฿${payout.amountThb.toLocaleString()}`}</td>
                    <td className="px-4 py-3 font-mono text-xs">{payout.reference}</td>
                    <td className="px-4 py-3">{payout.executedOn}</td>
                    <td className="px-4 py-3">{payout.recordedBy}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {payout.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleReconcilePayout(payout.id)}
                        disabled={reconciling === payout.id}
                        className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50"
                      >
                        {labels['finance.reconciliation.mark_reconciled']}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {totalUnmatched === 0 && totalFailedRefunds === 0 && totalPendingPayouts === 0 && (
        <section className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="text-xl font-bold text-gray-900 mb-2">{labels['finance.reconciliation.all_clear']}</div>
          <div className="text-gray-600">{labels['finance.reconciliation.no_issues']}</div>
        </section>
      )}
    </div>
  )
}
