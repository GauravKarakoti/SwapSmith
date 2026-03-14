'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, Star, ChevronDown } from 'lucide-react';
import { useCryptoFavorites } from '@/hooks/useCryptoFavorites';
import { getCoins, getCoinPrices, type Coin, type CoinPrice } from '@/utils/sideshift-client';

interface CryptoOption {
  coin: string;
  name: string;
  network: string;
  price?: string;
  isFavorite?: boolean;
}

interface CryptoSelectorProps {
  value?: string;
  onSelect: (crypto: CryptoOption) => void;
  placeholder?: string;
  className?: string;
  showPrices?: boolean;
  disabled?: boolean;
}

export default function CryptoSelector({
  value,
  onSelect,
  placeholder = "Select cryptocurrency",
  className = "",
  showPrices = false,
  disabled = false
}: CryptoSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [cryptos, setCryptos] = useState<CryptoOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { favorites, toggleFavorite, isFavorite, sortWithFavorites } = useCryptoFavorites();

  // Load cryptocurrencies
  useEffect(() => {
    const loadCryptos = async () => {
      try {
        setLoading(true);
        setError(null);

        if (showPrices) {
          // Load with prices
          const prices = await getCoinPrices();
          const cryptoOptions: CryptoOption[] = prices.map(price => ({
            coin: price.coin.toUpperCase(),
            name: price.name,
            network: price.network,
            price: price.usdPrice,
            isFavorite: isFavorite(price.coin.toUpperCase(), price.network)
          }));
          setCryptos(cryptoOptions);
        } else {
          // Load all available coins
          const coins = await getCoins();
          const cryptoOptions: CryptoOption[] = [];
          
          coins.forEach(coin => {
            coin.networks.forEach(network => {
              cryptoOptions.push({
                coin: coin.coin.toUpperCase(),
                name: coin.name,
                network: network.network,
                isFavorite: isFavorite(coin.coin.toUpperCase(), network.network)
              });
            });
          });
          
          setCryptos(cryptoOptions);
        }
      } catch (err) {
        console.error('Failed to load cryptocurrencies:', err);
        setError('Failed to load cryptocurrencies');
      } finally {
        setLoading(false);
      }
    };

    loadCryptos();
  }, [showPrices, isFavorite]);

  // Update favorite status when favorites change
  useEffect(() => {
    setCryptos(prev => prev.map(crypto => ({
      ...crypto,
      isFavorite: isFavorite(crypto.coin, crypto.network)
    })));
  }, [favorites, isFavorite]);

  // Filter and sort cryptos
  const filteredCryptos = useMemo(() => {
    let filtered = cryptos;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(crypto =>
        crypto.coin.toLowerCase().includes(query) ||
        crypto.name.toLowerCase().includes(query)
      );
    }

    // Sort with favorites first
    return sortWithFavorites(filtered);
  }, [cryptos, searchQuery, sortWithFavorites]);

  const handleToggleFavorite = (crypto: CryptoOption, e: React.MouseEvent) => {
    e.stopPropagation();
    toggleFavorite({
      coin: crypto.coin,
      name: crypto.name,
      network: crypto.network
    });
  };

  const handleSelect = (crypto: CryptoOption) => {
    onSelect(crypto);
    setIsOpen(false);
    setSearchQuery('');
  };

  const selectedCrypto = cryptos.find(c => `${c.coin}-${c.network}` === value);

  return (
    <div className={`relative ${className}`}>
      {/* Selector Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-4 py-3 
          bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 
          rounded-lg text-left transition-colors
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'hover:border-blue-500 focus:outline-none focus:border-blue-500'
          }
        `}
      >
        <div className="flex items-center gap-3">
          {selectedCrypto ? (
            <>
              <div className="flex items-center gap-2">
                {selectedCrypto.isFavorite && (
                  <Star className="w-4 h-4 text-yellow-500 fill-current" />
                )}
                <span className="font-mono font-bold text-sm">
                  {selectedCrypto.coin}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {selectedCrypto.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">
                  {selectedCrypto.network}
                  {selectedCrypto.price && (
                    <span className="ml-2">${selectedCrypto.price}</span>
                  )}
                </span>
              </div>
            </>
          ) : (
            <span className="text-gray-500 dark:text-zinc-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg shadow-xl z-50 max-h-80 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-gray-200 dark:border-zinc-700">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search cryptocurrencies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-50 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Options List */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading...</div>
            ) : error ? (
              <div className="p-4 text-center text-red-500">{error}</div>
            ) : filteredCryptos.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No cryptocurrencies found</div>
            ) : (
              filteredCryptos.map((crypto, index) => (
                <div
                  key={`${crypto.coin}-${crypto.network}-${index}`}
                  onClick={() => handleSelect(crypto)}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-700 cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => handleToggleFavorite(crypto, e)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-zinc-600 rounded transition-colors"
                      >
                        <Star 
                          className={`w-4 h-4 ${
                            crypto.isFavorite 
                              ? 'text-yellow-500 fill-current' 
                              : 'text-gray-300 dark:text-zinc-600'
                          }`} 
                        />
                      </button>
                      <span className="font-mono font-bold text-sm">
                        {crypto.coin}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {crypto.name}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-zinc-400">
                        {crypto.network}
                      </span>
                    </div>
                  </div>
                  {crypto.price && (
                    <span className="text-sm font-medium text-gray-600 dark:text-zinc-300">
                      ${crypto.price}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Overlay to close dropdown */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}