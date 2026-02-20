'use client'

import { Search, X, SlidersHorizontal, ChevronDown } from 'lucide-react';
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
    <div className="glass rounded-[2rem] p-5 mb-8 border-primary transition-all duration-300 shadow-xl">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Input Area */}
        <div className="flex-1 relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-muted group-focus-within:text-accent-primary transition-colors" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search assets (e.g. BTC, Ethereum)..."
            className="block w-full pl-12 pr-12 py-3.5 profile-input rounded-2xl text-[15px] font-medium transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-4 flex items-center group/btn"
            >
              <div className="p-1 rounded-full hover:bg-red-500/10 transition-colors">
                <X className="h-4 w-4 text-muted group-hover/btn:text-red-500" />
              </div>
            </button>
          )}
        </div>

        {/* Mobile Filter Toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="md:hidden flex items-center justify-center gap-2 px-4 py-3.5 bg-secondary text-primary rounded-2xl border border-primary hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all font-bold text-sm"
        >
          <SlidersHorizontal className="h-4 h-4 text-accent-primary" />
          <span>Filters</span>
        </button>

        {/* Desktop Sort Dropdown */}
        <div className="hidden md:block relative group">
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as 'name' | 'price' | 'symbol')}
            className="appearance-none block w-full pl-5 pr-12 py-3.5 profile-select rounded-2xl text-sm font-bold cursor-pointer transition-all border-primary"
          >
            <option value="name">Sort by Name</option>
            <option value="symbol">Sort by Symbol</option>
            <option value="price">Sort by Price</option>
          </select>
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-muted group-hover:text-primary transition-colors">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Mobile Filters Reveal */}
      {showFilters && (
        <div className="md:hidden mt-4 pt-4 border-t border-primary animate-in fade-in slide-in-from-top-2">
          <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-muted mb-3 px-1">
            Reorder By
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['name', 'symbol', 'price'] as const).map((option) => (
              <button
                key={option}
                onClick={() => onSortChange(option)}
                className={`py-2.5 rounded-xl text-xs font-bold capitalize border transition-all ${
                  sortBy === option 
                  ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                  : 'bg-secondary border-primary text-secondary'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Meta-data */}
      <div className="mt-5 flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-muted">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-primary animate-pulse" />
          Market Index
        </div>
        <div className="text-xs font-medium text-secondary">
          Displaying <span className="text-primary font-bold">{filteredCount}</span> 
          <span className="text-muted mx-1">/</span> 
          <span className="text-primary font-bold">{totalCoins}</span> Assets
        </div>
      </div>
    </div>
  );
}