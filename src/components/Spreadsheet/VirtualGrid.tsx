import React, { useEffect, useRef, useCallback, useState } from 'react';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';
import type { Cell, CellStyle } from '../../../shared/types';
import { evaluateConditionalFormat, mergeCellStyles, formatNumber, parseNumberFormat } from '../../utils/conditionalFormat/conditionalFormatEngine';
import { createCompoundKey } from '../../utils/formula';

interface VirtualGridProps {
  onCellClick: (cellId: string, event: React.MouseEvent) => void;
  onCellDoubleClick: (cellId: string) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  cellId: string | null;
}

const ROWS = 100;
const COLS = 26;
const ROW_HEADER_WIDTH = 60;
const COL_HEADER_HEIGHT = 30;
const CELL_WIDTH = 120;
const CELL_HEIGHT = 32;
const SCROLLBAR_WIDTH = 14;
const SCROLLBAR_HEIGHT = 14;
const SPILL_MARKER_SIZE = 8;

export const VirtualGrid: React.FC<VirtualGridProps> = ({ onCellClick, onCellDoubleClick }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 });
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectionStart, setSelectionStart] = useState<string | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, cellId: null });

  const cells = useSpreadsheetStore(state => state.cells);
  const selectedCell = useSpreadsheetStore(state => state.selectedCell);
  const circularCells = useSpreadsheetStore(state => state.circularCells);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const cellStyles = useSpreadsheetStore(state => state.cellStyles);
  const conditionalFormats = useSpreadsheetStore(state => state.conditionalFormats);
  const collaborators = useSpreadsheetStore(state => state.collaborators);
  const sheets = useSpreadsheetStore(state => state.sheets);

  const getSheetsMap = useCallback(() => {
    const map: Record<string, Record<string, Cell>> = {};
    sheets.forEach(sheet => {
      map[sheet.id] = sheet.cells;
    });
    return map;
  }, [sheets]);

  const formatCellValue = useCallback((cell: Cell, style?: CellStyle): string => {
    if (cell.value === null || cell.value === undefined) return '';
    
    if (cell.isError || cell.isCircular) {
      return cell.errorMessage || '#ERROR!';
    }

    if (style?.numberFormat && typeof cell.value === 'number') {
      const { type, options } = parseNumberFormat(style.numberFormat);
      return formatNumber(cell.value, type, options);
    }

    const format = cell.format;
    let value = cell.value;

    if (value instanceof Date) {
      if (format?.dateFormat === 'MM/DD/YYYY') {
        return `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`;
      }
      return value.toISOString().split('T')[0];
    }

    if (typeof value === 'number' && cell.type !== 'text') {
      let formatted = value.toString();
      
      if (format?.decimalPlaces !== undefined) {
        formatted = value.toFixed(format.decimalPlaces);
      }
      
      if (format?.useThousandsSeparator) {
        const parts = formatted.split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        formatted = parts.join('.');
      }
      
      return formatted;
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    return String(value);
  }, []);

  const getCellStyle = useCallback((cell: Cell, cellId: string): { textColor: string; backgroundColor: string; fontBold: boolean; fontItalic: boolean; textAlign: 'left' | 'center' | 'right' | undefined } => {
    const compoundKey = createCompoundKey(activeSheetId, cellId);
    const baseStyle = cellStyles[compoundKey];
    
    const sheetsMap = getSheetsMap();
    const conditionalResults = conditionalFormats
      .filter(f => f.sheetId === activeSheetId)
      .map(format => evaluateConditionalFormat(format, sheetsMap, compoundKey));
    
    const mergedStyle = mergeCellStyles(baseStyle, conditionalResults);
    
    let textColor = cell.format?.textColor || '#1f2937';
    let backgroundColor = cell.format?.backgroundColor || '#ffffff';
    let fontBold = cell.format?.isBold || false;
    let fontItalic = cell.format?.isItalic || false;
    let textAlign = cell.format?.align;

    if (baseStyle) {
      if (baseStyle.fontColor) textColor = baseStyle.fontColor;
      if (baseStyle.bgColor && !baseStyle.bgColor.startsWith('linear-gradient')) {
        backgroundColor = baseStyle.bgColor;
      }
      if (baseStyle.bold) fontBold = baseStyle.bold;
      if (baseStyle.italic) fontItalic = baseStyle.italic;
      if (baseStyle.align) textAlign = baseStyle.align;
    }

    if (mergedStyle.color) textColor = mergedStyle.color as string;
    if (mergedStyle.backgroundColor) backgroundColor = mergedStyle.backgroundColor as string;
    if (mergedStyle.background) backgroundColor = mergedStyle.background as string;
    if (mergedStyle.fontWeight === 'bold') fontBold = true;
    if (mergedStyle.fontStyle === 'italic') fontItalic = true;
    if (mergedStyle.textAlign) textAlign = mergedStyle.textAlign as 'left' | 'center' | 'right';

    if (cell.isCircular || cell.isError) {
      textColor = '#dc2626';
    }

    if (cell.isCircular) {
      backgroundColor = '#fef2f2';
    }

    return { textColor, backgroundColor, fontBold, fontItalic, textAlign };
  }, [activeSheetId, cellStyles, conditionalFormats, getSheetsMap]);

  const getCellTextColor = (cell: Cell): string => {
    if (cell.isCircular) return '#dc2626';
    if (cell.isError) return '#dc2626';
    return cell.format?.textColor || '#1f2937';
  };

  const getCellBackgroundColor = (cell: Cell, cellId: string): string => {
    if (cellId === selectedCell) return '#dbeafe';
    if (selectionStart && selectionEnd) {
      const { startCol, startRow, endCol, endRow } = getSelectionRange();
      const col = cellId.charCodeAt(0) - 65;
      const row = parseInt(cellId.slice(1)) - 1;
      if (col >= Math.min(startCol, endCol) && col <= Math.max(startCol, endCol) &&
          row >= Math.min(startRow, endRow) && row <= Math.max(startRow, endRow)) {
        return '#dbeafe';
      }
    }
    if (cell.isCircular) return '#fef2f2';
    return cell.format?.backgroundColor || '#ffffff';
  };

  const getSelectionRange = () => {
    const start = selectionStart || selectedCell || 'A1';
    const end = selectionEnd || selectionStart || selectedCell || 'A1';
    return {
      startCol: start.charCodeAt(0) - 65,
      startRow: parseInt(start.slice(1)) - 1,
      endCol: end.charCodeAt(0) - 65,
      endRow: parseInt(end.slice(1)) - 1
    };
  };

  const cellIdToPosition = (cellId: string): { col: number; row: number } => {
    const col = cellId.charCodeAt(0) - 65;
    const row = parseInt(cellId.slice(1)) - 1;
    return { col, row };
  };

  const positionToCellId = (col: number, row: number): string => {
    return `${String.fromCharCode(65 + col)}${row + 1}`;
  };

  const getCellFromPoint = (clientX: number, clientY: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < ROW_HEADER_WIDTH || y < COL_HEADER_HEIGHT) return null;

    const viewportWidth = containerSize.width - ROW_HEADER_WIDTH - SCROLLBAR_WIDTH;
    const viewportHeight = containerSize.height - COL_HEADER_HEIGHT - SCROLLBAR_HEIGHT;
    const totalWidth = COLS * CELL_WIDTH;
    const totalHeight = ROWS * CELL_HEIGHT;
    const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);
    const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
    const clampedScrollLeft = Math.min(scrollLeft, maxScrollLeft);
    const clampedScrollTop = Math.min(scrollTop, maxScrollTop);

    const col = Math.floor((x - ROW_HEADER_WIDTH + clampedScrollLeft) / CELL_WIDTH);
    const row = Math.floor((y - COL_HEADER_HEIGHT + clampedScrollTop) / CELL_HEIGHT);

    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      return positionToCellId(col, row);
    }

    return null;
  };

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = containerSize.width;
    const height = containerSize.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, width, height);

    const totalWidth = COLS * CELL_WIDTH;
    const totalHeight = ROWS * CELL_HEIGHT;
    const viewportWidth = width - ROW_HEADER_WIDTH - SCROLLBAR_WIDTH;
    const viewportHeight = height - COL_HEADER_HEIGHT - SCROLLBAR_HEIGHT;

    const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);
    const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
    const clampedScrollLeft = Math.min(scrollLeft, maxScrollLeft);
    const clampedScrollTop = Math.min(scrollTop, maxScrollTop);

    const startCol = Math.floor(clampedScrollLeft / CELL_WIDTH);
    const endCol = Math.min(COLS - 1, Math.ceil((clampedScrollLeft + viewportWidth) / CELL_WIDTH));
    const startRow = Math.floor(clampedScrollTop / CELL_HEIGHT);
    const endRow = Math.min(ROWS - 1, Math.ceil((clampedScrollTop + viewportHeight) / CELL_HEIGHT));

    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, ROW_HEADER_WIDTH, COL_HEADER_HEIGHT);

    ctx.fillStyle = '#f3f4f6';
    for (let col = startCol; col <= endCol; col++) {
      const x = ROW_HEADER_WIDTH + (col * CELL_WIDTH) - clampedScrollLeft;
      const colLetter = String.fromCharCode(65 + col);
      
      const selectedCol = selectedCell ? selectedCell.charCodeAt(0) - 65 : -1;
      if (col === selectedCol) {
        ctx.fillStyle = '#dbeafe';
      } else {
        ctx.fillStyle = '#f3f4f6';
      }
      ctx.fillRect(x, 0, CELL_WIDTH, COL_HEADER_HEIGHT);

      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, 0, CELL_WIDTH, COL_HEADER_HEIGHT);

      ctx.fillStyle = '#374151';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(colLetter, x + CELL_WIDTH / 2, COL_HEADER_HEIGHT / 2);
    }

    ctx.fillStyle = '#f3f4f6';
    for (let row = startRow; row <= endRow; row++) {
      const y = COL_HEADER_HEIGHT + (row * CELL_HEIGHT) - clampedScrollTop;
      
      const selectedRow = selectedCell ? parseInt(selectedCell.slice(1)) - 1 : -1;
      if (row === selectedRow) {
        ctx.fillStyle = '#dbeafe';
      } else {
        ctx.fillStyle = '#f3f4f6';
      }
      ctx.fillRect(0, y, ROW_HEADER_WIDTH, CELL_HEIGHT);

      ctx.strokeStyle = '#d1d5db';
      ctx.strokeRect(0, y, ROW_HEADER_WIDTH, CELL_HEIGHT);

      ctx.fillStyle = '#374151';
      ctx.font = 'bold 12px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(row + 1), ROW_HEADER_WIDTH / 2, y + CELL_HEIGHT / 2);
    }

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const cellId = positionToCellId(col, row);
        const x = ROW_HEADER_WIDTH + (col * CELL_WIDTH) - clampedScrollLeft;
        const y = COL_HEADER_HEIGHT + (row * CELL_HEIGHT) - clampedScrollTop;
        const cell = cells[cellId] || { id: cellId, type: 'text', rawValue: '', value: '', isError: false, isCircular: false };
        const compoundKey = createCompoundKey(activeSheetId, cellId);
        const style = cellStyles[compoundKey];
        const { textColor, backgroundColor, fontBold, fontItalic, textAlign } = getCellStyle(cell, cellId);

        ctx.fillStyle = backgroundColor;
        ctx.fillRect(x, y, CELL_WIDTH, CELL_HEIGHT);

        let borderColor = '#e5e7eb';
        let borderWidth = 1;

        if (cell.isSpillCell) {
          borderColor = '#bfdbfe';
          borderWidth = 2;
        }

        if (cell.errorMessage === '#SPILL!') {
          borderColor = '#dc2626';
          borderWidth = 2;
        }

        ctx.strokeStyle = borderColor;
        ctx.lineWidth = borderWidth;
        ctx.strokeRect(x, y, CELL_WIDTH, CELL_HEIGHT);

        if (cellId === selectedCell) {
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, CELL_WIDTH - 2, CELL_HEIGHT - 2);
        }

        if (cell.spillSource && cell.spillSource === cellId) {
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(
            x + CELL_WIDTH - SPILL_MARKER_SIZE - 2,
            y + CELL_HEIGHT - SPILL_MARKER_SIZE - 2,
            SPILL_MARKER_SIZE,
            SPILL_MARKER_SIZE
          );
        }

        const text = formatCellValue(cell, style);
        let font = '13px "JetBrains Mono", monospace';
        if (fontBold) {
          font = 'bold ' + font;
        }
        if (fontItalic) {
          font = 'italic ' + font;
        }
        ctx.font = font;
        ctx.fillStyle = textColor;
        
        let textX = x + 8;
        if (textAlign === 'center') {
          ctx.textAlign = 'center';
          textX = x + CELL_WIDTH / 2;
        } else if (textAlign === 'right') {
          ctx.textAlign = 'right';
          textX = x + CELL_WIDTH - 8;
        } else {
          ctx.textAlign = 'left';
        }
        ctx.textBaseline = 'middle';

        const padding = 8;
        const maxWidth = CELL_WIDTH - padding * 2;
        const metrics = ctx.measureText(text);
        
        let displayText = text;
        if (metrics.width > maxWidth) {
          let truncated = text;
          while (ctx.measureText(truncated + '...').width > maxWidth && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
          }
          displayText = truncated + '...';
        }

        ctx.fillText(displayText, textX, y + CELL_HEIGHT / 2);
      }
    }

    Object.entries(collaborators).forEach(([userId, collab]) => {
      if (collab.sheetId !== activeSheetId || !collab.cellId) return;
      
      const { col, row } = cellIdToPosition(collab.cellId);
      if (col < startCol || col > endCol || row < startRow || row > endRow) return;

      const x = ROW_HEADER_WIDTH + (col * CELL_WIDTH) - clampedScrollLeft;
      const y = COL_HEADER_HEIGHT + (row * CELL_HEIGHT) - clampedScrollTop;

      ctx.strokeStyle = collab.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, CELL_WIDTH - 2, CELL_HEIGHT - 2);

      ctx.fillStyle = collab.color;
      ctx.fillRect(x + 1, y - 18, 60, 18);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(collab.name, x + 4, y - 9);
    });

    if (totalWidth > viewportWidth) {
      const scrollbarX = clampedScrollLeft / totalWidth * viewportWidth;
      const scrollbarWidth = (viewportWidth / totalWidth) * viewportWidth;
      
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(
        ROW_HEADER_WIDTH,
        height - SCROLLBAR_HEIGHT,
        viewportWidth,
        SCROLLBAR_HEIGHT
      );
      
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(
        ROW_HEADER_WIDTH + scrollbarX,
        height - SCROLLBAR_HEIGHT + 2,
        scrollbarWidth,
        SCROLLBAR_HEIGHT - 4
      );
    }

    if (totalHeight > viewportHeight) {
      const scrollbarY = clampedScrollTop / totalHeight * viewportHeight;
      const scrollbarSize = (viewportHeight / totalHeight) * viewportHeight;
      
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(
        width - SCROLLBAR_WIDTH,
        COL_HEADER_HEIGHT,
        SCROLLBAR_WIDTH,
        viewportHeight
      );
      
      ctx.fillStyle = '#9ca3af';
      ctx.fillRect(
        width - SCROLLBAR_WIDTH + 2,
        COL_HEADER_HEIGHT + scrollbarY,
        SCROLLBAR_WIDTH - 4,
        scrollbarSize
      );
    }

    ctx.fillStyle = '#e5e7eb';
    ctx.fillRect(
      width - SCROLLBAR_WIDTH,
      height - SCROLLBAR_HEIGHT,
      SCROLLBAR_WIDTH,
      SCROLLBAR_HEIGHT
    );

  }, [containerSize, scrollTop, scrollLeft, cells, selectedCell, circularCells, selectionStart, selectionEnd, activeSheetId, cellStyles, conditionalFormats, collaborators, formatCellValue, getCellStyle, getSheetsMap]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (contextMenu.visible) {
      setContextMenu({ ...contextMenu, visible: false });
    }
    const cellId = getCellFromPoint(e.clientX, e.clientY);
    if (cellId) {
      setIsDragging(true);
      setSelectionStart(cellId);
      setSelectionEnd(cellId);
      onCellClick(cellId, e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const cellId = getCellFromPoint(e.clientX, e.clientY);
    if (cellId) {
      setSelectionEnd(cellId);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    const cellId = getCellFromPoint(e.clientX, e.clientY);
    if (cellId) {
      onCellDoubleClick(cellId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    
    const totalWidth = COLS * CELL_WIDTH;
    const totalHeight = ROWS * CELL_HEIGHT;
    const viewportWidth = containerSize.width - ROW_HEADER_WIDTH - SCROLLBAR_WIDTH;
    const viewportHeight = containerSize.height - COL_HEADER_HEIGHT - SCROLLBAR_HEIGHT;
    
    const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);
    const maxScrollTop = Math.max(0, totalHeight - viewportHeight);

    setScrollLeft(prev => Math.max(0, Math.min(maxScrollLeft, prev + e.deltaX)));
    setScrollTop(prev => Math.max(0, Math.min(maxScrollTop, prev + e.deltaY)));
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const cellId = getCellFromPoint(e.clientX, e.clientY);
    if (cellId) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        setContextMenu({
          visible: true,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
          cellId
        });
      }
    }
  };

  const handleInsertChart = () => {
    if (!selectionStart && !selectionEnd) return;
    const state = useSpreadsheetStore.getState();
    if (!state.workbookId) return;
    const { startCol, startRow, endCol, endRow } = getSelectionRange();
    const minCol = Math.min(startCol, endCol);
    const maxCol = Math.max(startCol, endCol);
    const minRow = Math.min(startRow, endRow);
    const maxRow = Math.max(startRow, endRow);
    const rangeRef = `${String.fromCharCode(65 + minCol)}${minRow + 1}:${String.fromCharCode(65 + maxCol)}${maxRow + 1}`;
    
    state.addChart({
      workbookId: state.workbookId,
      sheetId: activeSheetId,
      rangeRef,
      type: 'bar',
      options: { title: 'New Chart' }
    });
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleSetCellFormat = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleInsertRow = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleDeleteRow = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleInsertColumn = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  const handleDeleteColumn = () => {
    setContextMenu({ ...contextMenu, visible: false });
  };

  const getEditorPosition = (cellId: string): { x: number; y: number; width: number; height: number } | null => {
    const { col, row } = cellIdToPosition(cellId);
    
    const viewportWidth = containerSize.width - ROW_HEADER_WIDTH - SCROLLBAR_WIDTH;
    const viewportHeight = containerSize.height - COL_HEADER_HEIGHT - SCROLLBAR_HEIGHT;
    const totalWidth = COLS * CELL_WIDTH;
    const totalHeight = ROWS * CELL_HEIGHT;
    const maxScrollLeft = Math.max(0, totalWidth - viewportWidth);
    const maxScrollTop = Math.max(0, totalHeight - viewportHeight);
    const clampedScrollLeft = Math.min(scrollLeft, maxScrollLeft);
    const clampedScrollTop = Math.min(scrollTop, maxScrollTop);

    const cellLeft = ROW_HEADER_WIDTH + (col * CELL_WIDTH) - clampedScrollLeft;
    const cellTop = COL_HEADER_HEIGHT + (row * CELL_HEIGHT) - clampedScrollTop;

    if (cellLeft < ROW_HEADER_WIDTH || cellLeft > containerSize.width - SCROLLBAR_WIDTH - CELL_WIDTH ||
        cellTop < COL_HEADER_HEIGHT || cellTop > containerSize.height - SCROLLBAR_HEIGHT - CELL_HEIGHT) {
      return null;
    }

    return {
      x: cellLeft,
      y: cellTop,
      width: CELL_WIDTH,
      height: CELL_HEIGHT
    };
  };

  const hasSelection = selectionStart && selectionEnd && selectionStart !== selectionEnd;

  return (
    <div ref={containerRef} className="relative flex-1 overflow-hidden bg-white">
      <canvas
        ref={canvasRef}
        className="cursor-cell"
        style={{ width: containerSize.width, height: containerSize.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onWheel={handleWheel}
        onContextMenu={handleContextMenu}
      />
      
      {contextMenu.visible && (
        <div
          className="absolute bg-white border border-gray-200 rounded-md shadow-lg z-20 min-w-[160px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {hasSelection && (
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleInsertChart}
            >
              插入图表
            </button>
          )}
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            onClick={handleSetCellFormat}
          >
            设置单元格格式
          </button>
          <div className="border-t border-gray-200 my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            onClick={handleInsertRow}
          >
            插入行
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            onClick={handleDeleteRow}
          >
            删除行
          </button>
          <div className="border-t border-gray-200 my-1" />
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            onClick={handleInsertColumn}
          >
            插入列
          </button>
          <button
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
            onClick={handleDeleteColumn}
          >
            删除列
          </button>
        </div>
      )}
      
      {selectedCell && (() => {
        const pos = getEditorPosition(selectedCell);
        const editingCell = useSpreadsheetStore.getState().editingCell;
        
        if (!pos || editingCell !== selectedCell) return null;
        
        const cell = cells[selectedCell];
        const editValue = cell?.formula || cell?.rawValue || '';
        
        return (
          <input
            key={`editor-${selectedCell}`}
            type="text"
            className="absolute bg-white border-2 border-blue-500 outline-none px-2 font-mono text-sm z-10"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.width,
              height: pos.height,
              fontSize: '13px',
              fontFamily: '"JetBrains Mono", monospace'
            }}
            defaultValue={editValue}
            autoFocus
            onBlur={(e) => {
              const value = e.target.value;
              if (value !== (cell?.rawValue || '')) {
                useSpreadsheetStore.getState().updateCell(selectedCell, value);
              }
              useSpreadsheetStore.getState().setEditingCell(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                const value = (e.target as HTMLInputElement).value;
                if (value !== (cell?.rawValue || '')) {
                  useSpreadsheetStore.getState().updateCell(selectedCell, value);
                }
                useSpreadsheetStore.getState().setEditingCell(null);
                
                const { row } = cellIdToPosition(selectedCell);
                if (row < ROWS - 1) {
                  const nextCellId = positionToCellId(selectedCell.charCodeAt(0) - 65, row + 1);
                  useSpreadsheetStore.getState().setSelectedCell(nextCellId);
                }
              } else if (e.key === 'Escape') {
                useSpreadsheetStore.getState().setEditingCell(null);
              } else if (e.key === 'Tab') {
                e.preventDefault();
                const value = (e.target as HTMLInputElement).value;
                if (value !== (cell?.rawValue || '')) {
                  useSpreadsheetStore.getState().updateCell(selectedCell, value);
                }
                useSpreadsheetStore.getState().setEditingCell(null);
                
                const { col } = cellIdToPosition(selectedCell);
                if (!e.shiftKey && col < COLS - 1) {
                  const nextCellId = positionToCellId(col + 1, parseInt(selectedCell.slice(1)) - 1);
                  useSpreadsheetStore.getState().setSelectedCell(nextCellId);
                } else if (e.shiftKey && col > 0) {
                  const nextCellId = positionToCellId(col - 1, parseInt(selectedCell.slice(1)) - 1);
                  useSpreadsheetStore.getState().setSelectedCell(nextCellId);
                }
              }
            }}
          />
        );
      })()}
    </div>
  );
};
