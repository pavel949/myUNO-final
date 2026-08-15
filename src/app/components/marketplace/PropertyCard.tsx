'use client';

import { FC } from 'react';
import Image from 'next/image';

interface PropertyCardProps {
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
  onCardClick?: () => void;
  onHeartClick?: () => void;
  isFavorited?: boolean;
}

export const PropertyCard: FC<PropertyCardProps> = ({
  id,
  title,
  price,
  image,
  rating,
  reviewCount,
  location,
  instantBook,
  superhost,
  verified,
  onCardClick,
  onHeartClick,
  isFavorited,
}) => {
  return (
    <div
      className="group cursor-pointer"
      onClick={onCardClick}
    >
      {/* Image Container */}
      <div className="relative mb-3 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-800 aspect-square">
        {image && (
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        {/* Favorite Button */}
        <button
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white dark:bg-gray-900 shadow-md hover:shadow-lg transition-shadow flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onHeartClick?.();
          }}
        >
          <svg
            className={`w-5 h-5 ${
              isFavorited ? 'fill-red-500 text-red-500' : 'text-gray-600 dark:text-gray-300'
            }`}
            fill={isFavorited ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
            />
          </svg>
        </button>

        {/* Status Badge */}
        {instantBook && (
          <div className="absolute bottom-3 left-3 bg-slate-700 dark:bg-slate-600 text-white text-xs font-semibold px-2 py-1 rounded-md">
            Мгновенное бронирование
          </div>
        )}
      </div>

      {/* Content */}
      <div className="space-y-2">
        {/* Title & Badges */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 leading-snug">
            {title}
          </h3>
          <div className="flex items-center gap-1 whitespace-nowrap">
            <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {rating.toFixed(2)}
            </span>
            {reviewCount > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                ({reviewCount})
              </span>
            )}
          </div>
        </div>

        {/* Location */}
        <p className="text-xs text-gray-600 dark:text-gray-400">{location}</p>

        {/* Price */}
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">
            {price.toLocaleString()} ฿
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">за ночь</span>
        </div>

        {/* Trust Badges */}
        {(superhost || verified) && (
          <div className="flex gap-2 pt-1">
            {superhost && (
              <div className="flex items-center gap-1 text-xs bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-2 py-1 rounded-md">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Суперхост
              </div>
            )}
            {verified && (
              <div className="flex items-center gap-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-md">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Подтверждено
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
