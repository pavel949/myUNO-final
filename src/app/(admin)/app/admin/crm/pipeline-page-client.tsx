'use client'

import { useState, useEffect } from 'react'
import Container from '@/app/components/Container'
import Heading from '@/app/components/Heading'

type LifecycleStage = 'contact' | 'guest' | 'repeat_guest' | 'investment_interest' | 'qualified_buyer' | 'purchaser' | 'owner' | 'managed_owner'

interface PipelineProfile {
  id: string
  lifecycle_stage: LifecycleStage
  lead_score: number
  account_owner_identity_id?: string
  next_step_at?: string
  lifecycle_changed_at?: string
  first_source?: string
}

interface StageColumn {
  stage: LifecycleStage
  label: string
  profiles: PipelineProfile[]
  count: number
}

export default function PipelinePage() {
  const [stages, setStages] = useState<StageColumn[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const stageOrder: LifecycleStage[] = [
    'contact',
    'guest',
    'repeat_guest',
    'investment_interest',
    'qualified_buyer',
    'purchaser',
    'owner',
    'managed_owner',
  ]

  const stageLabels: Record<LifecycleStage, string> = {
    contact: 'Contact',
    guest: 'Guest',
    repeat_guest: 'Repeat Guest',
    investment_interest: 'Investment Interest',
    qualified_buyer: 'Qualified Buyer',
    purchaser: 'Purchaser',
    owner: 'Owner',
    managed_owner: 'Managed Owner',
  }

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        setLoading(true)
        // TODO: Create GET /api/admin/crm/pipeline endpoint
        // For now, show placeholder structure
        const emptyStages = stageOrder.map(stage => ({
          stage,
          label: stageLabels[stage],
          profiles: [],
          count: 0,
        }))
        setStages(emptyStages)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load pipeline')
      } finally {
        setLoading(false)
      }
    }

    fetchPipeline()
  }, [])

  return (
    <Container>
      <Heading title="Customer Lifecycle Pipeline" subtitle="Drag to transition. Click to edit." />

      {error && (
        <div className="mb-8 rounded-md bg-red-50 p-4 text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12">Loading pipeline...</div>
      ) : (
        <div className="overflow-x-auto">
          <div className="flex gap-4 pb-4" style={{ minWidth: '100%' }}>
            {stages.map(stageColumn => (
              <div
                key={stageColumn.stage}
                className="flex-shrink-0 w-80 bg-gray-50 rounded-lg p-4 border border-gray-200"
              >
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">
                    {stageColumn.label}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {stageColumn.count} customer{stageColumn.count !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="space-y-2">
                  {stageColumn.profiles.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">
                      No customers in this stage
                    </div>
                  ) : (
                    stageColumn.profiles.map(profile => (
                      <div
                        key={profile.id}
                        className="bg-white rounded border border-gray-300 p-3 cursor-pointer hover:border-blue-400 hover:shadow-sm transition"
                      >
                        <p className="font-medium text-sm text-gray-900">
                          {profile.id.slice(0, 8)}...
                        </p>
                        <p className="text-xs text-gray-500">
                          Lead score: {profile.lead_score}
                        </p>
                        {profile.next_step_at && (
                          <p className="text-xs text-orange-600 mt-1">
                            ⏰ Next step: {new Date(profile.next_step_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 text-sm text-gray-600">
        <p>🏗️ Pipeline UI is coming soon. Drag-and-drop transitions will be available in the next release.</p>
      </div>
    </Container>
  )
}
