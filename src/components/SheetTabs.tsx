import React, { useState, useRef, useEffect } from 'react';
import { Plus, MoreHorizontal, Trash2, Copy, Edit3, Palette } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Sheet } from '../../shared/types';
import { cn } from '../lib/utils';

interface SheetTabsProps {
  sheets: Sheet[];
  activeSheetId: string;
  onActiveSheetChange: (sheetId: string) => void;
  onRenameSheet: (sheetId: string, name: string) => void;
  onDeleteSheet: (sheetId: string) => void;
  onCopySheet: (sheetId: string) => void;
  onReorderSheet: (sheetId: string, newIndex: number) => void;
  onCreateSheet: (name?: string) => void;
  onTabColorChange?: (sheetId: string, color: string) => void;
}

interface SortableSheetTabProps {
  sheet: Sheet;
  isActive: boolean;
  isEditing: boolean;
  editName: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onEditNameChange: (name: string) => void;
  onEditBlur: () => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onDoubleClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onClick: () => void;
}

const COLORS = [
  { name: '无颜色', value: 'transparent' },
  { name: '红色', value: '#ef4444' },
  { name: '橙色', value: '#f97316' },
  { name: '黄色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#a855f7' },
  { name: '粉色', value: '#ec4899' },
];

const SortableSheetTab: React.FC<SortableSheetTabProps> = ({
  sheet,
  isActive,
  isEditing,
  editName,
  inputRef,
  onEditNameChange,
  onEditBlur,
  onEditKeyDown,
  onDoubleClick,
  onContextMenu,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: sheet.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative h-8 flex items-center min-w-[80px] max-w-[180px] px-3 border-x border-gray-200',
        'cursor-pointer select-none group',
        isActive ? 'bg-white border-t-2 border-t-blue-500 -mt-px' : 'bg-gray-50 hover:bg-gray-100',
        isDragging ? 'opacity-50 shadow-lg z-50' : ''
      )}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      {sheet.tabColor && sheet.tabColor !== 'transparent' && (
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: sheet.tabColor }}
        />
      )}

      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => onEditNameChange(e.target.value)}
          onBlur={onEditBlur}
          onKeyDown={onEditKeyDown}
          className="w-full h-6 px-1 text-sm border border-blue-500 focus:outline-none bg-white"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="text-sm truncate flex-1"
          style={{ color: isActive ? '#1e40af' : '#374151' }}
        >
          {sheet.name}
        </span>
      )}

      {!isEditing && (
        <div
          {...attributes}
          {...listeners}
          className="ml-1 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        >
          <MoreHorizontal size={14} />
        </div>
      )}
    </div>
  );
};

interface ContextMenuProps {
  x: number;
  y: number;
  sheet: Sheet;
  onRename: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onInsertBefore: () => void;
  onInsertAfter: () => void;
  onColorChange: (color: string) => void;
  onClose: () => void;
  canDelete: boolean;
  showColorOption: boolean;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  sheet,
  onRename,
  onDelete,
  onCopy,
  onInsertBefore,
  onInsertAfter,
  onColorChange,
  onClose,
  canDelete,
  showColorOption,
}) => {
  const [showColors, setShowColors] = useState(false);

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]"
        style={{ left: x, top: y }}
      >
        <button
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
          onClick={onRename}
        >
          <Edit3 size={14} />
          重命名
        </button>
        <button
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
          onClick={onCopy}
        >
          <Copy size={14} />
          复制
        </button>
        <div className="border-t border-gray-100 my-1" />
        <button
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
          onClick={onInsertBefore}
        >
          <Plus size={14} />
          前面插入
        </button>
        <button
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
          onClick={onInsertAfter}
        >
          <Plus size={14} />
          后面插入
        </button>
        {showColorOption && (
          <>
            <div className="border-t border-gray-100 my-1" />
            <div className="relative">
              <button
                className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 text-gray-700"
                onClick={() => setShowColors(!showColors)}
              >
                <Palette size={14} />
                标签颜色
                <div
                  className="ml-auto w-4 h-4 rounded border border-gray-300"
                  style={{ backgroundColor: sheet.tabColor || 'transparent' }}
                />
              </button>
              {showColors && (
                <div className="absolute left-full top-0 ml-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 grid grid-cols-4 gap-1">
                  {COLORS.map((color) => (
                    <button
                      key={color.value}
                      className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                      onClick={() => {
                        onColorChange(color.value);
                        setShowColors(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {canDelete && (
          <>
            <div className="border-t border-gray-100 my-1" />
            <button
              className="w-full px-4 py-2 text-left text-sm hover:bg-red-50 flex items-center gap-2 text-red-600"
              onClick={onDelete}
            >
              <Trash2 size={14} />
              删除
            </button>
          </>
        )}
      </div>
    </>
  );
};

export const SheetTabs: React.FC<SheetTabsProps> = ({
  sheets,
  activeSheetId,
  onActiveSheetChange,
  onRenameSheet,
  onDeleteSheet,
  onCopySheet,
  onReorderSheet,
  onCreateSheet,
  onTabColorChange,
}) => {
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    sheet: Sheet;
  } | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (editingSheetId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingSheetId]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (over && active.id !== over.id) {
      const oldIndex = sheets.findIndex((s) => s.id === active.id);
      const newIndex = sheets.findIndex((s) => s.id === over.id);
      const newSheets = arrayMove<Sheet>(sheets, oldIndex, newIndex);
      newSheets.forEach((sheet, index) => {
        if (sheet.index !== index) {
          onReorderSheet(sheet.id, index);
        }
      });
    }
  };

  const handleDoubleClick = (sheet: Sheet) => {
    setEditingSheetId(sheet.id);
    setEditName(sheet.name);
    setContextMenu(null);
  };

  const handleEditBlur = () => {
    if (editingSheetId) {
      const trimmedName = editName.trim();
      if (trimmedName && trimmedName !== sheets.find((s) => s.id === editingSheetId)?.name) {
        const existing = sheets.find(
          (s) => s.id !== editingSheetId && s.name.toLowerCase() === trimmedName.toLowerCase()
        );
        if (!existing) {
          onRenameSheet(editingSheetId, trimmedName);
        }
      }
      setEditingSheetId(null);
      setEditName('');
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleEditBlur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingSheetId(null);
      setEditName('');
    }
  };

  const handleContextMenu = (e: React.MouseEvent, sheet: Sheet) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, sheet });
    setEditingSheetId(null);
  };

  const handleDelete = (sheet: Sheet) => {
    if (sheets.length <= 1) return;
    if (confirm(`确定要删除工作表 "${sheet.name}" 吗？`)) {
      onDeleteSheet(sheet.id);
    }
    setContextMenu(null);
  };

  const handleRename = () => {
    if (contextMenu) {
      handleDoubleClick(contextMenu.sheet);
    }
  };

  const handleCopy = () => {
    if (contextMenu) {
      onCopySheet(contextMenu.sheet.id);
      setContextMenu(null);
    }
  };

  const handleInsertBefore = () => {
    if (contextMenu) {
      const existingNames = sheets.map((s) => s.name);
      const newName = 'Sheet';
      let counter = 1;
      while (existingNames.includes(`${newName}${counter}`)) {
        counter++;
      }
      onCreateSheet(`${newName}${counter}`);
      setContextMenu(null);
    }
  };

  const handleInsertAfter = () => {
    if (contextMenu) {
      const existingNames = sheets.map((s) => s.name);
      const newName = 'Sheet';
      let counter = 1;
      while (existingNames.includes(`${newName}${counter}`)) {
        counter++;
      }
      onCreateSheet(`${newName}${counter}`);
      setContextMenu(null);
    }
  };

  const handleColorChange = (color: string) => {
    if (contextMenu && onTabColorChange) {
      onTabColorChange(contextMenu.sheet.id, color);
      setContextMenu(null);
    }
  };

  const activeSheet = sheets.find((s) => s.id === activeId);
  const visibleSheets = sheets.filter((s) => !s.isHidden);

  return (
    <div className="relative flex items-center bg-gray-50 border-t border-gray-200 px-2 overflow-x-auto">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={visibleSheets.map((s) => s.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex items-center">
            {visibleSheets.map((sheet) => (
              <SortableSheetTab
                key={sheet.id}
                sheet={sheet}
                isActive={sheet.id === activeSheetId}
                isEditing={sheet.id === editingSheetId}
                editName={editName}
                inputRef={sheet.id === editingSheetId ? inputRef : null}
                onEditNameChange={setEditName}
                onEditBlur={handleEditBlur}
                onEditKeyDown={handleEditKeyDown}
                onDoubleClick={() => handleDoubleClick(sheet)}
                onContextMenu={(e) => handleContextMenu(e, sheet)}
                onClick={() => {
                  if (!editingSheetId) {
                    onActiveSheetChange(sheet.id);
                  }
                }}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId && activeSheet ? (
            <div
              className="h-8 flex items-center px-3 bg-white border border-blue-500 rounded shadow-lg"
              style={{ minWidth: '80px' }}
            >
              <span className="text-sm text-gray-700">{activeSheet.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <button
        onClick={() => {
          const existingNames = sheets.map((s) => s.name);
          const newName = 'Sheet';
          let counter = 1;
          while (existingNames.includes(`${newName}${counter}`)) {
            counter++;
          }
          onCreateSheet(`${newName}${counter}`);
        }}
        className="h-8 w-8 flex items-center justify-center text-gray-500 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
        title="新建工作表"
      >
        <Plus size={18} />
      </button>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          sheet={contextMenu.sheet}
          onRename={handleRename}
          onDelete={() => handleDelete(contextMenu.sheet)}
          onCopy={handleCopy}
          onInsertBefore={handleInsertBefore}
          onInsertAfter={handleInsertAfter}
          onColorChange={handleColorChange}
          onClose={() => setContextMenu(null)}
          canDelete={sheets.length > 1}
          showColorOption={!!onTabColorChange}
        />
      )}
    </div>
  );
};
