import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, GripHorizontal } from 'lucide-react';
import type { Chart } from '../../shared/types';
import { ChartComponent } from './ChartComponent';

interface ChartOverlayProps {
  chart: Chart;
  onClose: () => void;
  onUpdate?: (chart: Chart) => void;
}

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

const MIN_WIDTH = 300;
const MIN_HEIGHT = 250;
const DEFAULT_WIDTH = 500;
const DEFAULT_HEIGHT = 400;

export const ChartOverlay: React.FC<ChartOverlayProps> = ({ chart, onClose, onUpdate }) => {
  const [position, setPosition] = useState<Position>({ x: 100, y: 100 });
  const [size, setSize] = useState<Size>({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState<ResizeDirection>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (overlayRef.current) {
      const rect = overlayRef.current.getBoundingClientRect();
      const parentRect = overlayRef.current.parentElement?.getBoundingClientRect();
      if (parentRect) {
        setPosition({
          x: Math.max(0, parentRect.width / 2 - size.width / 2),
          y: Math.max(0, parentRect.height / 2 - size.height / 2)
        });
      }
    }
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent, direction: ResizeDirection = null) => {
    e.preventDefault();
    e.stopPropagation();

    if (direction) {
      setIsResizing(direction);
    } else {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      const parent = overlayRef.current?.parentElement;
      if (parent) {
        const parentRect = parent.getBoundingClientRect();
        const boundedX = Math.max(0, Math.min(newX, parentRect.width - size.width));
        const boundedY = Math.max(0, Math.min(newY, parentRect.height - size.height));
        setPosition({ x: boundedX, y: boundedY });
      } else {
        setPosition({ x: newX, y: newY });
      }
    }

    if (isResizing) {
      const parent = overlayRef.current?.parentElement;
      const parentRect = parent?.getBoundingClientRect();
      
      let newWidth = size.width;
      let newHeight = size.height;
      let newX = position.x;
      let newY = position.y;

      if (isResizing.includes('e')) {
        newWidth = Math.max(MIN_WIDTH, e.clientX - position.x);
      }
      if (isResizing.includes('w')) {
        const delta = position.x - e.clientX;
        newWidth = Math.max(MIN_WIDTH, size.width + delta);
        if (parentRect) {
          newX = Math.max(0, e.clientX);
        } else {
          newX = e.clientX;
        }
      }
      if (isResizing.includes('s')) {
        newHeight = Math.max(MIN_HEIGHT, e.clientY - position.y);
      }
      if (isResizing.includes('n')) {
        const delta = position.y - e.clientY;
        newHeight = Math.max(MIN_HEIGHT, size.height + delta);
        if (parentRect) {
          newY = Math.max(0, e.clientY);
        } else {
          newY = e.clientY;
        }
      }

      if (parentRect) {
        newWidth = Math.min(newWidth, parentRect.width - newX);
        newHeight = Math.min(newHeight, parentRect.height - newY);
      }

      setSize({ width: newWidth, height: newHeight });
      if (isResizing.includes('w') || isResizing.includes('n')) {
        setPosition({ x: newX, y: newY });
      }
    }
  }, [isDragging, isResizing, dragOffset, position, size]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const resizeHandlers: { direction: ResizeDirection; className: string }[] = [
    { direction: 'n', className: 'top-0 left-0 right-0 h-2 cursor-n-resize' },
    { direction: 's', className: 'bottom-0 left-0 right-0 h-2 cursor-s-resize' },
    { direction: 'e', className: 'top-0 right-0 w-2 h-full cursor-e-resize' },
    { direction: 'w', className: 'top-0 left-0 w-2 h-full cursor-w-resize' },
    { direction: 'ne', className: 'top-0 right-0 w-4 h-4 cursor-ne-resize' },
    { direction: 'nw', className: 'top-0 left-0 w-4 h-4 cursor-nw-resize' },
    { direction: 'se', className: 'bottom-0 right-0 w-4 h-4 cursor-se-resize' },
    { direction: 'sw', className: 'bottom-0 left-0 w-4 h-4 cursor-sw-resize' },
  ];

  return (
    <div
      ref={overlayRef}
      className="absolute bg-white rounded-lg shadow-2xl border border-gray-300 overflow-hidden z-40"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 'auto' : size.height,
        minWidth: MIN_WIDTH,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white cursor-grab active:cursor-grabbing"
        onMouseDown={(e) => handleMouseDown(e)}
        onDoubleClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={16} className="opacity-70" />
          <span className="text-sm font-medium truncate">
            {chart.options.title || `图表 - ${chart.type}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title={isMinimized ? '展开' : '最小化'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMinimized ? (
                <path d="M12 5v14M5 12h14" />
              ) : (
                <path d="M5 12h14" />
              )}
            </svg>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
            title="关闭"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="relative" style={{ height: size.height - 41 }}>
          <ChartComponent chart={chart} onClose={onClose} />
          
          {resizeHandlers.map(({ direction, className }) => (
            <div
              key={direction}
              className={`absolute ${className} z-10`}
              onMouseDown={(e) => handleMouseDown(e, direction)}
            />
          ))}

          <div className="absolute bottom-1 right-1 text-[10px] text-gray-400 pointer-events-none">
            {Math.round(size.width)} × {Math.round(size.height)}
          </div>
        </div>
      )}
    </div>
  );
};
