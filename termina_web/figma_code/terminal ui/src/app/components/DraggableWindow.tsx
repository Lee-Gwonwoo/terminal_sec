import React, { useRef, useState } from 'react';
import { Resizable } from 're-resizable';
import { X, Maximize2, Minimize2, GripVertical } from 'lucide-react';
import { WindowInstance, WindowType } from '../types';
import { NewsWindow } from './NewsWindow';
import { WatchlistWindow } from './WatchlistWindow';
import { CalendarWindow } from './CalendarWindow';

interface DraggableWindowProps {
  window: WindowInstance;
  onClose: () => void;
  onTickerClick?: (ticker: string) => void;
  initialTicker?: string;
  style?: React.CSSProperties;
  onDragStart?: () => void;
  onDragEnd?: (x: number, y: number) => void;
}

export function DraggableWindow({ 
  window, 
  onClose, 
  onTickerClick,
  initialTicker,
  style,
  onDragStart,
  onDragEnd
}: DraggableWindowProps) {
  const [isMaximized, setIsMaximized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ 
    x: window.position?.left || 20, 
    y: window.position?.top || 20 
  });
  const [size, setSize] = useState({
    width: window.position?.width || 600,
    height: window.position?.height || 500
  });
  const windowRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMaximized) return;
    
    const rect = windowRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      setIsDragging(true);
      onDragStart?.();
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && !isMaximized) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      setPosition({ x: newX, y: newY });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      onDragEnd?.(position.x, position.y);
    }
  };

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const renderWindowContent = () => {
    switch (window.type) {
      case 'news':
        return <NewsWindow onTickerClick={onTickerClick} initialTicker={initialTicker} />;
      case 'watchlist':
        return <WatchlistWindow onTickerClick={onTickerClick} />;
      case 'calendar':
        return <CalendarWindow onTickerClick={onTickerClick} />;
      default:
        return <div>Unknown window type</div>;
    }
  };

  const windowStyle: React.CSSProperties = isMaximized
    ? {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10
      }
    : {
        position: 'absolute',
        top: position.y,
        left: position.x,
        ...style
      };

  return (
    <Resizable
      size={{
        width: isMaximized ? '100%' : size.width,
        height: isMaximized ? '100%' : size.height,
      }}
      minWidth={300}
      minHeight={200}
      enable={{
        top: !isMaximized,
        right: !isMaximized,
        bottom: !isMaximized,
        left: !isMaximized,
        topRight: !isMaximized,
        bottomRight: !isMaximized,
        bottomLeft: !isMaximized,
        topLeft: !isMaximized,
      }}
      onResizeStop={(e, direction, ref, d) => {
        setSize({
          width: size.width + d.width,
          height: size.height + d.height,
        });
      }}
      style={windowStyle}
      handleStyles={{
        right: { 
          right: '-4px', 
          width: '8px', 
          cursor: 'ew-resize',
          top: '0',
          height: '100%',
          zIndex: 10
        },
        bottom: { 
          bottom: '-4px', 
          height: '8px', 
          cursor: 'ns-resize',
          left: '0',
          width: '100%',
          zIndex: 10
        },
        bottomRight: { 
          right: '-4px', 
          bottom: '-4px', 
          width: '20px', 
          height: '20px', 
          cursor: 'nwse-resize',
          zIndex: 10
        },
        left: { 
          left: '-4px', 
          width: '8px', 
          cursor: 'ew-resize',
          top: '0',
          height: '100%',
          zIndex: 10
        },
        top: { 
          top: '-4px', 
          height: '8px', 
          cursor: 'ns-resize',
          left: '0',
          width: '100%',
          zIndex: 10
        },
        topRight: { 
          right: '-4px', 
          top: '-4px', 
          width: '20px', 
          height: '20px', 
          cursor: 'nesw-resize',
          zIndex: 10
        },
        bottomLeft: { 
          left: '-4px', 
          bottom: '-4px', 
          width: '20px', 
          height: '20px', 
          cursor: 'nesw-resize',
          zIndex: 10
        },
        topLeft: { 
          left: '-4px', 
          top: '-4px', 
          width: '20px', 
          height: '20px', 
          cursor: 'nwse-resize',
          zIndex: 10
        },
      }}
      handleClasses={{
        right: 'resize-handle-vertical',
        bottom: 'resize-handle-horizontal',
        bottomRight: 'resize-handle-corner',
        left: 'resize-handle-vertical',
        top: 'resize-handle-horizontal',
        topRight: 'resize-handle-corner',
        bottomLeft: 'resize-handle-corner',
        topLeft: 'resize-handle-corner',
      }}
    >
      <div
        ref={windowRef}
        className="h-full flex flex-col bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden"
      >
        {/* Window Header */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700 cursor-move select-none"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center gap-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium">{window.title}</span>
            {window.linkId && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded">
                Link #{window.linkId}
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-red-100 dark:hover:bg-red-900 hover:text-red-600 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Window Content */}
        <div className="flex-1 overflow-hidden">
          {renderWindowContent()}
        </div>
      </div>
    </Resizable>
  );
}