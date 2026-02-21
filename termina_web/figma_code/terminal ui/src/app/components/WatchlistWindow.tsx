import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { mockWatchlistData } from '../mockData';
import { WatchlistItem } from '../types';

interface WatchlistWindowProps {
  onTickerClick?: (ticker: string) => void;
}

export function WatchlistWindow({ onTickerClick }: WatchlistWindowProps) {
  const [watchlist] = React.useState<WatchlistItem[]>(mockWatchlistData);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-medium">Watchlist</h3>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-sm font-medium">
        <div className="col-span-2">Ticker</div>
        <div className="col-span-4">Name</div>
        <div className="col-span-2 text-right">Price</div>
        <div className="col-span-2 text-right">Change</div>
        <div className="col-span-2 text-right">%</div>
      </div>

      {/* Watchlist Items */}
      <div className="flex-1 overflow-auto">
        {watchlist.map(item => (
          <button
            key={item.ticker}
            onClick={() => onTickerClick?.(item.ticker)}
            className="w-full grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
          >
            <div className="col-span-2 font-medium text-blue-600 dark:text-blue-400">
              {item.ticker}
            </div>
            <div className="col-span-4 text-sm text-gray-600 dark:text-gray-400 truncate">
              {item.name}
            </div>
            <div className="col-span-2 text-right">
              ${item.price.toFixed(2)}
            </div>
            <div className={`col-span-2 text-right flex items-center justify-end gap-1 ${
              item.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {item.change >= 0 ? (
                <TrendingUp className="w-4 h-4" />
              ) : (
                <TrendingDown className="w-4 h-4" />
              )}
              {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
            </div>
            <div className={`col-span-2 text-right ${
              item.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
