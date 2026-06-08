import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Underline,
  Strikethrough,
  Percent,
  DollarSign,
  Thermometer,
  Hash,
  BarChart3,
  Undo2,
  Redo2,
  Layers,
  PieChart,
  Users,
  History,
  ChevronDown,
  Paintbrush,
  Type,
  Filter
} from 'lucide-react';
import type { CellStyle, ConditionalFormat } from '../../shared/types';
import { useSpreadsheetStore } from '../store/useSpreadsheetStore';
import { cn } from '../lib/utils';

interface ToolbarProps {
  onOpenConditionalFormat: () => void;
}

type NumberFormatOption = {
  label: string;
  value: string;
  icon?: React.ReactNode;
};

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
  '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd'
];

const NUMBER_FORMATS: NumberFormatOption[] = [
  { label: '通用', value: 'general' },
  { label: '百分比', value: 'percent', icon: <Percent size={14} /> },
  { label: '货币', value: 'currency', icon: <DollarSign size={14} /> },
  { label: '科学计数', value: 'scientific', icon: <Thermometer size={14} /> },
  { label: '千分位', value: 'thousands', icon: <Hash size={14} /> },
];

const PANEL_OPTIONS = [
  { id: 'sheets', label: 'Sheets', icon: <Layers size={16} /> },
  { id: 'charts', label: 'Charts', icon: <PieChart size={16} /> },
  { id: 'collaboration', label: '协同', icon: <Users size={16} /> },
  { id: 'history', label: '历史', icon: <History size={16} /> },
] as const;

export const Toolbar: React.FC<ToolbarProps> = ({ onOpenConditionalFormat }) => {
  const [showNumberFormatMenu, setShowNumberFormatMenu] = useState(false);
  const [showFontColorPicker, setShowFontColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showDecimalMenu, setShowDecimalMenu] = useState(false);
  const [decimalPlaces, setDecimalPlaces] = useState(2);

  const fontColorRef = useRef<HTMLDivElement>(null);
  const bgColorRef = useRef<HTMLDivElement>(null);
  const numberFormatRef = useRef<HTMLDivElement>(null);
  const decimalRef = useRef<HTMLDivElement>(null);

  const selectedCell = useSpreadsheetStore(state => state.selectedCell);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const cellStyles = useSpreadsheetStore(state => state.cellStyles);
  const undoStack = useSpreadsheetStore(state => state.undoStack);
  const redoStack = useSpreadsheetStore(state => state.redoStack);
  const activePanel = useSpreadsheetStore(state => state.activePanel);
  const setCellFormat = useSpreadsheetStore(state => state.setCellFormat);
  const undo = useSpreadsheetStore(state => state.undo);
  const redo = useSpreadsheetStore(state => state.redo);
  const setActivePanel = useSpreadsheetStore(state => state.setActivePanel);

  const currentStyle = selectedCell ? cellStyles[`${activeSheetId}:${selectedCell}`] : null;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fontColorRef.current && !fontColorRef.current.contains(e.target as Node)) {
        setShowFontColorPicker(false);
      }
      if (bgColorRef.current && !bgColorRef.current.contains(e.target as Node)) {
        setShowBgColorPicker(false);
      }
      if (numberFormatRef.current && !numberFormatRef.current.contains(e.target as Node)) {
        setShowNumberFormatMenu(false);
      }
      if (decimalRef.current && !decimalRef.current.contains(e.target as Node)) {
        setShowDecimalMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleStyleChange = (style: Partial<CellStyle>) => {
    if (selectedCell) {
      setCellFormat(selectedCell, style);
    }
  };

  const handleFontColorChange = (color: string) => {
    handleStyleChange({ fontColor: color });
    setShowFontColorPicker(false);
  };

  const handleBgColorChange = (color: string) => {
    handleStyleChange({ bgColor: color });
    setShowBgColorPicker(false);
  };

  const handleNumberFormatChange = (format: string) => {
    handleStyleChange({ numberFormat: format });
    setShowNumberFormatMenu(false);
  };

  const handleDecimalChange = (places: number) => {
    setDecimalPlaces(places);
    handleStyleChange({ numberFormat: `0.${'0'.repeat(places)}` });
    setShowDecimalMenu(false);
  };

  const handleToggleBold = () => {
    handleStyleChange({ bold: !currentStyle?.bold });
  };

  const handleToggleItalic = () => {
    handleStyleChange({ italic: !currentStyle?.italic });
  };

  const handleAlignChange = (align: 'left' | 'center' | 'right') => {
    handleStyleChange({ align });
  };

  const handlePanelToggle = (panelId: typeof PANEL_OPTIONS[number]['id']) => {
    if (activePanel === panelId) {
      setActivePanel(null);
    } else {
      setActivePanel(panelId);
    }
  };

  const getCurrentNumberFormatLabel = () => {
    const format = currentStyle?.numberFormat;
    if (!format) return '通用';
    const option = NUMBER_FORMATS.find(o => o.value === format);
    return option?.label || format;
  };

  return (
    <div className="h-10 flex items-center gap-1 px-2 bg-white border-b border-gray-200 text-sm">
      <div className="flex items-center gap-0.5 pr-2 border-r border-gray-200">
        <button
          onClick={undo}
          disabled={undoStack.length === 0}
          className={cn(
            "p-1.5 rounded transition-colors",
            undoStack.length > 0 ? "hover:bg-gray-100 text-gray-700" : "text-gray-300 cursor-not-allowed"
          )}
          title="撤销 (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </button>
        <button
          onClick={redo}
          disabled={redoStack.length === 0}
          className={cn(
            "p-1.5 rounded transition-colors",
            redoStack.length > 0 ? "hover:bg-gray-100 text-gray-700" : "text-gray-300 cursor-not-allowed"
          )}
          title="重做 (Ctrl+Y)"
        >
          <Redo2 size={16} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-gray-200" ref={fontColorRef}>
        <div className="relative">
          <button
            onClick={() => setShowFontColorPicker(!showFontColorPicker)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-700 flex flex-col items-center gap-0.5"
            title="字体颜色"
          >
            <Type size={16} />
            <div 
              className="w-4 h-1 rounded" 
              style={{ backgroundColor: currentStyle?.fontColor || '#000000' }}
            />
          </button>
          {showFontColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-56">
              <div className="text-xs text-gray-500 mb-2">字体颜色</div>
              <div className="grid grid-cols-10 gap-1">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => handleFontColorChange(color)}
                    className={cn(
                      "w-4 h-4 rounded border border-gray-200 hover:scale-110 transition-transform",
                      currentStyle?.fontColor === color && "ring-2 ring-blue-500"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-gray-500">自定义:</label>
                <input
                  type="color"
                  value={currentStyle?.fontColor || '#000000'}
                  onChange={(e) => handleFontColorChange(e.target.value)}
                  className="w-8 h-8 cursor-pointer rounded"
                />
              </div>
            </div>
          )}
        </div>

        <div className="relative" ref={bgColorRef}>
          <button
            onClick={() => setShowBgColorPicker(!showBgColorPicker)}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-700 flex flex-col items-center gap-0.5"
            title="背景颜色"
          >
            <Paintbrush size={16} />
            <div 
              className="w-4 h-1 rounded" 
              style={{ backgroundColor: currentStyle?.bgColor || '#ffffff', border: '1px solid #ccc' }}
            />
          </button>
          {showBgColorPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 w-56">
              <div className="text-xs text-gray-500 mb-2">背景颜色</div>
              <div className="grid grid-cols-10 gap-1">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => handleBgColorChange(color)}
                    className={cn(
                      "w-4 h-4 rounded border border-gray-200 hover:scale-110 transition-transform",
                      currentStyle?.bgColor === color && "ring-2 ring-blue-500"
                    )}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <label className="text-xs text-gray-500">自定义:</label>
                <input
                  type="color"
                  value={currentStyle?.bgColor || '#ffffff'}
                  onChange={(e) => handleBgColorChange(e.target.value)}
                  className="w-8 h-8 cursor-pointer rounded"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
        <button
          onClick={handleToggleBold}
          className={cn(
            "p-1.5 rounded transition-colors",
            currentStyle?.bold ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
          )}
          title="加粗 (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={handleToggleItalic}
          className={cn(
            "p-1.5 rounded transition-colors",
            currentStyle?.italic ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
          )}
          title="斜体 (Ctrl+I)"
        >
          <Italic size={16} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
        <button
          onClick={() => handleAlignChange('left')}
          className={cn(
            "p-1.5 rounded transition-colors",
            (!currentStyle?.align || currentStyle?.align === 'left') ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
          )}
          title="左对齐"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => handleAlignChange('center')}
          className={cn(
            "p-1.5 rounded transition-colors",
            currentStyle?.align === 'center' ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
          )}
          title="居中对齐"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => handleAlignChange('right')}
          className={cn(
            "p-1.5 rounded transition-colors",
            currentStyle?.align === 'right' ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
          )}
          title="右对齐"
        >
          <AlignRight size={16} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-gray-200" ref={numberFormatRef}>
        <div className="relative">
          <button
            onClick={() => setShowNumberFormatMenu(!showNumberFormatMenu)}
            className="px-2 py-1 hover:bg-gray-100 rounded transition-colors text-gray-700 flex items-center gap-1 min-w-[100px] text-xs"
            title="数字格式"
          >
            <span>{getCurrentNumberFormatLabel()}</span>
            <ChevronDown size={12} />
          </button>
          {showNumberFormatMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px]">
              {NUMBER_FORMATS.map(format => (
                <button
                  key={format.value}
                  onClick={() => handleNumberFormatChange(format.value)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs hover:bg-gray-50 flex items-center gap-2",
                    currentStyle?.numberFormat === format.value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  )}
                >
                  {format.icon}
                  <span>{format.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative" ref={decimalRef}>
          <button
            onClick={() => setShowDecimalMenu(!showDecimalMenu)}
            className="px-2 py-1 hover:bg-gray-100 rounded transition-colors text-gray-700 flex items-center gap-1 text-xs"
            title="小数位"
          >
            <span>.{decimalPlaces}</span>
            <ChevronDown size={12} />
          </button>
          {showDecimalMenu && (
            <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[100px]">
              {[0, 1, 2, 3, 4].map(n => (
                <button
                  key={n}
                  onClick={() => handleDecimalChange(n)}
                  className={cn(
                    "w-full px-3 py-2 text-left text-xs hover:bg-gray-50",
                    decimalPlaces === n ? "bg-blue-50 text-blue-700" : "text-gray-700"
                  )}
                >
                  {n} 位小数
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 px-2 border-r border-gray-200">
        <button
          onClick={onOpenConditionalFormat}
          className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-700 flex items-center gap-1"
          title="条件格式"
        >
          <Filter size={16} />
        </button>
        <button
          onClick={() => handlePanelToggle('charts')}
          className={cn(
            "p-1.5 rounded transition-colors",
            activePanel === 'charts' ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
          )}
          title="图表"
        >
          <BarChart3 size={16} />
        </button>
      </div>

      <div className="flex items-center gap-0.5 px-2">
        {PANEL_OPTIONS.map(option => (
          <button
            key={option.id}
            onClick={() => handlePanelToggle(option.id)}
            className={cn(
              "px-2 py-1 rounded transition-colors flex items-center gap-1 text-xs",
              activePanel === option.id 
                ? "bg-blue-100 text-blue-700" 
                : "hover:bg-gray-100 text-gray-700"
            )}
            title={option.label}
          >
            {option.icon}
            <span className="hidden sm:inline">{option.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
