// Core primitive components (doc 06 §3.1)
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';
export { Select } from './Select';
export { Chip } from './Chip';
export { StatusChip } from './StatusChip';
export { Counter } from './Counter';
export { Skeleton } from './Skeleton';
export { ConfirmDialog } from './ConfirmDialog';
export { ServiceCategoryIcon, SERVICE_CATEGORY_ICON_NAMES } from './ServiceCategoryIcon';
export { Avatar } from './Avatar';
export { Badge, VerifiedBadge } from './Badge';
export { EmptyState, LoadingState, ErrorState } from './StateComponents';
export { MoneyAmount, type MoneyAmountProps } from './MoneyAmount';
export { PriceBreakdown, type PriceBreakdownItem } from './PriceBreakdown';
export { StatusTimeline, type StatusTimelineEvent } from './StatusTimeline';
export { DataTable, type DataTableColumn } from './DataTable';
export { SlaCountdown } from './SlaCountdown';
export { RoleContextBanner } from './RoleContextBanner';
export { LegalEntityBlock } from './LegalEntityBlock';
export { getStatusVariant, STATUS_VARIANT_CLASSES, type StatusVariant } from '@/lib/status';

// Owner components
export { StatTile, ProjectSwitcher, BookingsList, LatestStatementCard, OpenTicketsList, SellInterestCard, OwnerStayModal } from './owner';

// In-stay components
export {
  StayCard,
  QuickActionsRow,
  ActiveOrdersList,
  AnnouncementsSection,
  ServicesRail,
  ExtendStayPanel,
  type RailService,
} from './instay';
