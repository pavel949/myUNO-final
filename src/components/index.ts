// Core primitive components (doc 06 §3.1)
export { Button } from './Button';
export { Input } from './Input';
export { Textarea } from './Textarea';
export { Select } from './Select';
export { Chip } from './Chip';
export { Counter } from './Counter';
export { Checkbox, Radio, Switch } from './ChoiceControls';
export { ConfirmDialog } from './ConfirmDialog';
export { DataTable } from './DataTable';
export { StatusTimeline } from './StatusTimeline';
export { SkeletonBlock } from './SkeletonBlock';
export { PriceBreakdown } from './PriceBreakdown';
export { ServiceCategoryIcon, SERVICE_CATEGORY_ICON_NAMES } from './ServiceCategoryIcon';
export { Avatar } from './Avatar';
export { Badge, VerifiedBadge } from './Badge';
export { EmptyState, LoadingState, ErrorState } from './StateComponents';
export { MoneyAmount, type MoneyAmountProps } from './MoneyAmount';
export { RoleContextBanner } from './RoleContextBanner';
export { TrustMark } from './TrustMark';
export { LegalEntityBlock } from './LegalEntityBlock';

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
