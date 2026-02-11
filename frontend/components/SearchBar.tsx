'use client'

import { Search, X, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

export interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortBy: 'name' | 'price' | 'symbol';
  onSortChange: (sort: 'name' | 'price' | 'symbol') => void;
  totalCoins: number;
  filteredCount: number;
}

export default function SearchBar({
  searchQuery,
  onSearchChange,
  sortBy,
  onSortChange,
  totalCoins,
  filteredCount,
}: SearchBarProps) {
  const [showFilters, setShowFilters] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 border border-gray-200 dark:border-gray-700">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input */}
        <div className="flex-1 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search by coin name or symbol..."
            className="block w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <X className="h-5 w-5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
            </button>
          )}
        </div>

        {/* Filter Toggle Button */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          <SlidersHorizontal className="h-5 w-5" />
          <span>Filters</span>
        </button>

        {/* Sort Dropdown - Desktop */}
        <div className="hidden md:block">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'name' | 'price' | 'symbol')}
            className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Sort by Name</option>
            <option value="symbol">Sort by Symbol</option>
            <option value="price">Sort by Price</option>
          </select>
        </div>
      </div>

      {/* Mobile Filters */}
      {showFilters && (
        <div className="md:hidden mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sort By
          </label>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'name' | 'price' | 'symbol')}
            className="block w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="name">Name</option>
            <option value="symbol">Symbol</option>
            <option value="price">Price</option>
          </select>
        </div>
      )}

      {/* Results Counter */}
      <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
        Showing <span className="font-semibold text-gray-900 dark:text-white">{filteredCount}</span> of{' '}
        <span className="font-semibold text-gray-900 dark:text-white">{totalCoins}</span> coins
      </div>
    </div>
  );
}
