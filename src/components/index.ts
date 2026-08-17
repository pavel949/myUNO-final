// Core primitive components (doc 06 §3.1)
export { Button } from './Button';
export { Input } from './Input';
export { Chip } from './Chip';
export { ServiceCategoryIcon, SERVICE_CATEGORY_ICON_NAMES } from './ServiceCategoryIcon';
export { Avatar } from './Avatar';
export { Badge, VerifiedBadge } from './Badge';
export { EmptyState, LoadingState, ErrorState } from './StateComponents';
export { RoleContextBanner } from './RoleContextBanner';
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
