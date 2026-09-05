'use client';

import { FC, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from 'react-beautiful-dnd';
import type { CrmOpportunity } from '@prisma/client';
import { OpportunityCard } from './OpportunityCard';

interface SerializedOpportunity extends Omit<CrmOpportunity, 'createdAt' | 'updatedAt' | 'expectedCloseAt' | 'nextActionAt' | 'wonAt' | 'lostAt'> {
  createdAt: string;
  updatedAt: string;
  expectedCloseAt: string | null;
  nextActionAt: string | null;
  wonAt: string | null;
  lostAt: string | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
    phone?: string | null;
    avatar?: string | null;
  } | null;
}

interface OpportunitiesKanbanProps {
  opportunities: SerializedOpportunity[];
  onUpdate?: () => void;
}

const STAGES = [
  'new',
  'qualified',
  'discovery',
  'proposal',
  'negotiation',
  'nurture',
  'won',
  'lost',
];

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  qualified: 'Qualified',
  discovery: 'Discovery',
  proposal: 'Proposal',
  negotiation: 'Negotiation',
  nurture: 'Nurture',
  won: 'Won',
  lost: 'Lost',
};

export const OpportunitiesKanban: FC<OpportunitiesKanbanProps> = ({
  opportunities,
  onUpdate,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedByStage = STAGES.reduce((acc, stage) => {
    acc[stage] = opportunities.filter((opp) => opp.stage === stage);
    return acc;
  }, {} as Record<string, typeof opportunities>);

  const handleCardClick = useCallback((opportunityId: string) => {
    router.push(`/app/admin/crm/opportunities/${opportunityId}`);
  }, [router]);

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { source, destination, draggableId } = result;

      if (!destination) return;

      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const newStage = destination.droppableId;
      const opportunityId = draggableId;

      setLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `/api/crm/opportunities/${opportunityId}/stage`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stage: newStage }),
          }
        );
        if (!response.ok) throw new Error('Failed to update');
        onUpdate?.();
      } catch (err) {
        setError('Failed to update opportunity stage');
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [onUpdate]
  );

  return (
    <div className="w-full h-full bg-surface-ivory p-6 rounded-lg overflow-x-auto">
      {error && (
        <div className="mb-4 p-3 bg-state-error-soft text-state-error rounded-lg text-sm">
          {error}
        </div>
      )}

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="flex gap-6 min-w-min">
          {STAGES.map((stage) => (
            <Droppable key={stage} droppableId={stage}>
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex-shrink-0 w-80 rounded-lg p-4 transition-colors ${
                    snapshot.isDraggingOver
                      ? 'bg-brand-andaman-soft'
                      : 'bg-surface-paper'
                  }`}
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-text-ink ">
                      {STAGE_LABELS[stage]}
                    </h3>
                    <span className="text-sm font-medium text-text-stone  bg-surface-ivory  px-2 py-1 rounded-full">
                      {groupedByStage[stage].length}
                    </span>
                  </div>

                  {/* Column Stats */}
                  {groupedByStage[stage].length > 0 && (
                    <div className="text-xs text-text-stone  mb-4 pb-4 border-b border-border-line ">
                      <div>
                        ฿
                        {(
                          groupedByStage[stage].reduce(
                            (sum, opp) =>
                              sum +
                              ((opp.valueThb ?? 0) * opp.probability) / 100,
                            0
                          ) / 1000
                        ).toFixed(0)}
                        K weighted
                      </div>
                    </div>
                  )}

                  {/* Cards */}
                  <div className="space-y-3">
                    {groupedByStage[stage].map((opportunity, index) => (
                      <Draggable
                        key={opportunity.id}
                        draggableId={opportunity.id}
                        index={index}
                        isDragDisabled={loading}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            className={`transition-opacity ${
                              snapshot.isDragging ? 'opacity-50' : ''
                            }`}
                          >
                            <OpportunityCard
                              opportunity={opportunity}
                              draggable={true}
                              onClick={() => handleCardClick(opportunity.id)}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                  </div>

                  {/* Empty State */}
                  {groupedByStage[stage].length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-sm text-text-stone ">
                        No opportunities
                      </p>
                    </div>
                  )}

                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
};
