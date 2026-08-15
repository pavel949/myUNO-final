'use client';

import { FC } from 'react';
import { PropertyCard } from './PropertyCard';
import { ProjectCard } from './ProjectCard';

interface Property {
  id: string;
  title: string;
  price: number;
  image: string;
  rating: number;
  reviewCount: number;
  location: string;
  instantBook?: boolean;
  superhost?: boolean;
  verified?: boolean;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  locationValue: string;
  unitCount: number;
  availableCount: number;
  averagePrice: number;
  averageRating: number;
  brand?: 'myUNO' | 'ClearView' | 'Ignatev';
}

interface MarketplaceGridProps {
  view?: 'properties' | 'projects' | 'all';
  properties?: Property[];
  projects?: Project[];
  isLoading?: boolean;
  onPropertyClick?: (id: string) => void;
  onProjectClick?: (id: string) => void;
  onPropertyHeartClick?: (id: string) => void;
  favorites?: Set<string>;
}

export const MarketplaceGrid: FC<MarketplaceGridProps> = ({
  view = 'all',
  properties = [],
  projects = [],
  isLoading = false,
  onPropertyClick,
  onProjectClick,
  onPropertyHeartClick,
  favorites = new Set(),
}) => {
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-lg aspect-square" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const showProperties = view === 'properties' || view === 'all';
  const showProjects = view === 'projects' || view === 'all';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Projects Section */}
      {showProjects && projects.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-serif font-semibold text-gray-900 dark:text-white">
              Откройте наши проекты
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Исследуйте общины и коллекции свойств по всему Пхукету
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                {...project}
                onCardClick={() => onProjectClick?.(project.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Properties Section */}
      {showProperties && properties.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-2xl font-serif font-semibold text-gray-900 dark:text-white">
              Доступные объекты недвижимости
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Выберите из тысяч уникальных свойств для вашего пребывания
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {properties.map((property) => (
              <PropertyCard
                key={property.id}
                {...property}
                onCardClick={() => onPropertyClick?.(property.id)}
                onHeartClick={() => onPropertyHeartClick?.(property.id)}
                isFavorited={favorites.has(property.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty State */}
      {properties.length === 0 && projects.length === 0 && (
        <div className="py-16 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M3 12a9 9 0 110 18 9 9 0 010-18z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Результаты не найдены
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Попробуйте изменить фильтры или критерии поиска
          </p>
        </div>
      )}
    </div>
  );
};
