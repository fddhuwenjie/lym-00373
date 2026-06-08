import React, { useState } from 'react';
import { X, Eye, EyeOff, Edit2, Trash2, Copy, GripVertical, Plus, Palette, Check } from 'lucide-react';
import type { Sheet } from '../../../shared/types';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';

interface SheetsPanelProps {
  onClose: () => void;
}

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280', '#ffffff'
];

export const SheetsPanel: React.FC<SheetsPanelProps> = ({ onClose }) => {
  const sheets = useSpreadsheetStore(state => state.sheets);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const setActiveSheet = useSpreadsheetStore(state => state.setActiveSheet);
  const createSheet = useSpreadsheetStore(state => state.createSheet);
  const renameSheet = useSpreadsheetStore(state => state.renameSheet);
  const deleteSheet = useSpreadsheetStore(state => state.deleteSheet);
  const copySheet = useSpreadsheetStore(state => state.copySheet);
  const reorderSheet = useSpreadsheetStore(state => state.reorderSheet);
  const toggleSheetVisibility = useSpreadsheetStore(state => state.toggleSheetVisibility);
  const setSheetTabColor = useSpreadsheetStore(state => state.setSheetTabColor);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const handleStartRename = (sheet: Sheet) => {
    setEditingId(sheet.id);
    setEditingName(sheet.name);
    setColorPickerFor(null);
  };

  const handleFinishRename = async () => {
    if (editingId && editingName.trim()) {
      await renameSheet(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleFinishRename();
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleDragStart = (e: React.DragEvent, sheetId: string) => {
    setDraggedId(sheetId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, sheetId: string) => {
    e.preventDefault();
    if (draggedId && draggedId !== sheetId) {
      setDragOverId(sheetId);
    }
  };

  const handleDragLeave = () => {
    setDragOverId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetSheet: Sheet) => {
    e.preventDefault();
    if (draggedId && draggedId !== targetSheet.id) {
      const fromIndex = sheets.findIndex(s => s.id === draggedId);
      const toIndex = sheets.findIndex(s => s.id === targetSheet.id);
      await reorderSheet(draggedId, toIndex);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleColorSelect = async (sheetId: string, color: string) => {
    await setSheetTabColor(sheetId, color);
    setColorPickerFor(null);
  };

  const handleDelete = async (sheetId: string) => {
    if (sheets.length <= 1) {
      alert('至少需要保留一个工作表');
      return;
    }
    if (confirm('确定要删除这个工作表吗？')) {
      await deleteSheet(sheetId);
    }
  };

  return (
    <div className="w-[280px] bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">工作表管理</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => createSheet()}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
            title="新建工作表"
          >
            <Plus size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500"
            title="关闭"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {sheets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <p>暂无工作表</p>
            <button
              onClick={() => createSheet()}
              className="mt-2 text-blue-500 hover:text-blue-600"
            >
              新建工作表
            </button>
          </div>
        ) : (
          <div className="space-y-1">
            {sheets.map((sheet) => (
              <div
                key={sheet.id}
                draggable={editingId !== sheet.id}
                onDragStart={(e) => handleDragStart(e, sheet.id)}
                onDragOver={(e) => handleDragOver(e, sheet.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, sheet)}
                onDragEnd={handleDragEnd}
                className={`
                  group relative flex items-center gap-2 p-2 rounded-lg cursor-pointer
                  transition-all duration-200
                  ${activeSheetId === sheet.id ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50 border border-transparent'}
                  ${dragOverId === sheet.id ? 'border-t-2 border-t-blue-500' : ''}
                  ${draggedId === sheet.id ? 'opacity-50' : ''}
                  ${sheet.isHidden ? 'opacity-60' : ''}
                `}
                onClick={() => editingId !== sheet.id && setActiveSheet(sheet.id)}
              >
                <div className="cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600">
                  <GripVertical size={14} />
                </div>

                <div
                  className="w-3 h-3 rounded-full flex-shrink-0 border border-gray-200"
                  style={{ backgroundColor: sheet.tabColor || '#e5e7eb' }}
                />

                {editingId === sheet.id ? (
                  <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleFinishRename}
                    onKeyDown={handleKeyDown}
                    className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 text-sm truncate text-gray-700">
                    {sheet.name}
                    <span className="text-xs text-gray-400 ml-1">#{sheet.index + 1}</span>
                  </span>
                )}

                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPickerFor(colorPickerFor === sheet.id ? null : sheet.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
                    title="标签颜色"
                  >
                    <Palette size={14} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSheetVisibility(sheet.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
                    title={sheet.isHidden ? '显示' : '隐藏'}
                  >
                    {sheet.isHidden ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartRename(sheet);
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
                    title="重命名"
                  >
                    <Edit2 size={14} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      copySheet(sheet.id);
                    }}
                    className="p-1 hover:bg-gray-200 rounded transition-colors text-gray-500"
                    title="复制"
                  >
                    <Copy size={14} />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(sheet.id);
                    }}
                    className="p-1 hover:bg-red-100 rounded transition-colors text-gray-500 hover:text-red-600"
                    title="删除"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {colorPickerFor === sheet.id && (
                  <div
                    className="absolute right-0 top-full mt-1 p-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10 flex flex-wrap gap-1 w-[180px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => handleColorSelect(sheet.id, color)}
                        className={`
                          w-6 h-6 rounded border-2 transition-transform hover:scale-110
                          ${sheet.tabColor === color ? 'border-blue-500' : 'border-gray-200'}
                        `}
                        style={{ backgroundColor: color }}
                      >
                        {sheet.tabColor === color && color !== '#ffffff' && (
                          <Check size={12} className="text-white mx-auto" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        共 {sheets.length} 个工作表
      </div>
    </div>
  );
};
