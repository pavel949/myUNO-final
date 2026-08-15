'use client';

import { FC, useState } from 'react';

interface MarketplaceHeaderProps {
  onSearchChange?: (query: string) => void;
  onFilterClick?: () => void;
}

export const MarketplaceHeader: FC<MarketplaceHeaderProps> = ({
  onSearchChange,
  onFilterClick,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    onSearchChange?.(value);
  };

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Logo & Brand */}
        <div className="py-4 flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 dark:from-slate-400 dark:to-slate-600 flex items-center justify-center">
              <span className="text-white dark:text-gray-950 font-bold text-sm">M</span>
            </div>
            <h1 className="text-xl font-serif font-semibold text-gray-900 dark:text-white">myUNO</h1>
          </div>
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400">
            Пхукет | Жилье и услуги
          </div>
        </div>

        {/* Search Bar */}
        <div className="pb-4 flex gap-3">
          <div className="flex-1 relative">
            <svg
              className="absolute left-4 top-3.5 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Поиск по локации, названию..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-12 pr-4 py-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-700 dark:focus:ring-slate-400"
            />
          </div>
          <button
            onClick={onFilterClick}
            className="px-4 py-3 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
              />
            </svg>
          </button>
        </div>

        {/* Filter Chips */}
        <div className="pb-4 flex gap-2 overflow-x-auto scrollbar-hide">
          <button className="px-4 py-2 rounded-full bg-slate-700 dark:bg-slate-600 text-white text-sm font-medium whitespace-nowrap hover:bg-slate-800 dark:hover:bg-slate-500 transition-colors">
            Все
          </button>
          <button className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Жилье
          </button>
          <button className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Услуги
          </button>
          <button className="px-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white text-sm font-medium whitespace-nowrap hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
            Проекты
          </button>
        </div>
      </div>
    </header>
  );
};
