/**
 * Browse & Marketplace Module
 *
 * Handles property discovery, project browsing, and listing presentation
 * across the myUNO platform for guests, residents, owners, and prospects.
 */

export interface BrowseFilters {
  projectId?: string;
  locationValue?: string;
  priceMin?: number;
  priceMax?: number;
  amenities?: string[];
  roomType?: string;
  category?: string;
  instantBook?: boolean;
  search?: string;
}

export interface ProjectSummary {
  id: string;
  name: string;
  locationValue: string;
  description?: string;
  coverImage?: string;
  unitCount: number;
  availableCount: number;
  averagePrice: number;
  averageRating: number;
  brand?: 'myUNO' | 'ClearView' | 'Ignatev';
}

export interface ListingSummary {
  id: string;
  projectId: string;
  title: string;
  category: string;
  roomType: string;
  price: number;
  images: string[];
  rating: number;
  reviewCount: number;
  amenities: string[];
  instantBook: boolean;
  hostVerified?: boolean;
  superhost?: boolean;
}

export interface BrowseService {
  getProjects(filters?: BrowseFilters): Promise<ProjectSummary[]>;
  getProjectById(projectId: string): Promise<ProjectSummary | null>;
  getListings(filters?: BrowseFilters): Promise<ListingSummary[]>;
  getListingById(listingId: string): Promise<ListingSummary | null>;
  searchListings(query: string, filters?: BrowseFilters): Promise<ListingSummary[]>;
}

// Placeholder implementation
export const browse = {
  async getProjects(): Promise<ProjectSummary[]> {
    return [];
  },
  async getProjectById(): Promise<null> {
    return null;
  },
  async getListings(): Promise<ListingSummary[]> {
    return [];
  },
  async getListingById(): Promise<null> {
    return null;
  },
  async searchListings(): Promise<ListingSummary[]> {
    return [];
  },
} as BrowseService;

// Saved villas and saved searches. Matching is here; what an alert *does* is a
// founder decision (Q38), so nothing in this module sends anything.
export {
  saveUnit,
  unsaveUnit,
  listSavedUnits,
  listSavedCollections,
  saveSearch,
  listSavedSearches,
  deleteSavedSearch,
  matchesSavedSearch,
  findSearchesMatching,
  type SaveUnitInput,
  type SearchCriteria,
  type MatchableUnit,
} from './saved.service';
