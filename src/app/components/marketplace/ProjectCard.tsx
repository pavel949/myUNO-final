'use client';

import { FC } from 'react';
import Image from 'next/image';

interface ProjectCardProps {
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
  onCardClick?: () => void;
}

export const ProjectCard: FC<ProjectCardProps> = ({
  id,
  name,
  description,
  coverImage,
  locationValue,
  unitCount,
  availableCount,
  averagePrice,
  averageRating,
  brand = 'myUNO',
  onCardClick,
}) => {
  const brandColors: Record<string, { bg: string; text: string }> = {
    myUNO: { bg: 'bg-slate-700 dark:bg-slate-600', text: 'text-white' },
    ClearView: { bg: 'bg-blue-600 dark:bg-blue-700', text: 'text-white' },
    Ignatev: { bg: 'bg-amber-700 dark:bg-amber-800', text: 'text-white' },
  };

  const brandColor = brandColors[brand];
  const occupancyRate = unitCount > 0 ? ((availableCount / unitCount) * 100).toFixed(0) : 0;

  return (
    <div
      className="group cursor-pointer h-full flex flex-col"
      onClick={onCardClick}
    >
      {/* Image Container */}
      <div className="relative mb-4 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 aspect-video">
        {coverImage && (
          <Image
            src={coverImage}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {/* Brand Badge */}
        <div className={`absolute top-3 left-3 ${brandColor.bg} ${brandColor.text} text-xs font-bold px-2 py-1 rounded-md`}>
          {brand}
        </div>

        {/* Occupancy Indicator */}
        <div className="absolute bottom-3 right-3 bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm rounded-lg px-3 py-2">
          <div className="text-xs font-semibold text-gray-900 dark:text-white">
            {availableCount}/{unitCount}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            доступно
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col space-y-3">
        {/* Header */}
        <div>
          <h3 className="text-base font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
            {name}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {locationValue}
          </p>
        </div>

        {/* Description */}
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
            {description}
          </p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 py-3 border-t border-gray-200 dark:border-gray-700">
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Средняя цена
            </div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {averagePrice.toLocaleString()} ฿
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
              Рейтинг
            </div>
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {averageRating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button className="w-full mt-auto px-4 py-2 rounded-lg bg-slate-700 dark:bg-slate-600 text-white text-sm font-medium hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors">
          Просмотреть юниты
        </button>
      </div>
    </div>
  );
};
