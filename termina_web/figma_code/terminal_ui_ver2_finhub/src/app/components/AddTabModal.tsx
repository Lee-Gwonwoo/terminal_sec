import React, { useState } from 'react';
import { X } from 'lucide-react';
import { WindowType } from '../types';

interface AddTabModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: (selectedWindows: WindowType[]) => void;
}

export function AddTabModal({ isOpen, onClose, onStart }: AddTabModalProps) {
  const [selectedWindows, setSelectedWindows] = useState<WindowType[]>(['news']);

  if (!isOpen) return null;

  const toggleWindow = (windowType: WindowType) => {
    if (selectedWindows.includes(windowType)) {
      setSelectedWindows(selectedWindows.filter(w => w !== windowType));
    } else {
      setSelectedWindows([...selectedWindows, windowType]);
    }
  };

  const handleStart = () => {
    if (selectedWindows.length > 0) {
      onStart(selectedWindows);
      setSelectedWindows(['news']);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-[500px] shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-medium">Add New Tab</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-medium mb-3">Window Select</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('calendar')}
                onChange={() => toggleWindow('calendar')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Calendar</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('news')}
                onChange={() => toggleWindow('news')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>News</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('finhub-news')}
                onChange={() => toggleWindow('finhub-news')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>News Feed: Finnhub API</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('investing-news')}
                onChange={() => toggleWindow('investing-news')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Investing News</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('watchlist')}
                onChange={() => toggleWindow('watchlist')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Watch List</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('default-ticker')}
                onChange={() => toggleWindow('default-ticker')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Default Ticker</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('daily-change-history')}
                onChange={() => toggleWindow('daily-change-history')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Daily Change History</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('data-control')}
                onChange={() => toggleWindow('data-control')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Data Control</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('case-research')}
                onChange={() => toggleWindow('case-research')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
                <span>AI Research Window</span>
            </label>

            <label className="flex items-center gap-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedWindows.includes('evidence-table')}
                onChange={() => toggleWindow('evidence-table')}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span>Evidence Table</span>
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={selectedWindows.length === 0}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Start
          </button>
        </div>
      </div>
    </div>
  );
}