import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Bold,
  Italic,
  Type,
  Paintbrush,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import type { CellStyle, ConditionalFormat, ConditionalFormatRuleType, ConditionalFormatRule, ConditionalFormatStyle } from '../../shared/types';
import { useSpreadsheetStore } from '../store/useSpreadsheetStore';
import { cn } from '../lib/utils';

interface ConditionalFormatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type RuleTypeOption = {
  label: string;
  value: ConditionalFormatRuleType;
  needsValue1?: boolean;
  needsValue2?: boolean;
  needsN?: boolean;
  needsColors?: boolean;
  needsBarColor?: boolean;
  isColorScale?: boolean;
};

const RULE_TYPE_OPTIONS: RuleTypeOption[] = [
  { label: '大于', value: 'greaterThan', needsValue1: true },
  { label: '小于', value: 'lessThan', needsValue1: true },
  { label: '大于或等于', value: 'greaterThanOrEqualTo', needsValue1: true },
  { label: '小于或等于', value: 'lessThanOrEqualTo', needsValue1: true },
  { label: '等于', value: 'equalTo', needsValue1: true },
  { label: '不等于', value: 'notEqualTo', needsValue1: true },
  { label: '介于', value: 'between', needsValue1: true, needsValue2: true },
  { label: '文本包含', value: 'containsText', needsValue1: true },
  { label: '文本不包含', value: 'notContainsText', needsValue1: true },
  { label: '重复值', value: 'duplicateValues' },
  { label: '唯一值', value: 'uniqueValues' },
  { label: 'Top N', value: 'topN', needsN: true },
  { label: 'Bottom N', value: 'bottomN', needsN: true },
  { label: '数据条', value: 'dataBar', needsBarColor: true },
  { label: '双色阶', value: 'twoColorScale', needsColors: true, isColorScale: true },
  { label: '三色阶', value: 'threeColorScale', needsColors: true, isColorScale: true },
];

const PRESET_COLORS = [
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef',
  '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff',
  '#9900ff', '#ff00ff', '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3',
  '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc', '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599',
];

const getRuleTypeLabel = (type: ConditionalFormatRuleType): string => {
  const option = RULE_TYPE_OPTIONS.find(o => o.value === type);
  return option?.label || type;
};

const getRuleDescription = (rule: ConditionalFormatRule): string => {
  const label = getRuleTypeLabel(rule.type);
  switch (rule.type) {
    case 'greaterThan':
    case 'lessThan':
    case 'greaterThanOrEqualTo':
    case 'lessThanOrEqualTo':
    case 'equalTo':
    case 'notEqualTo':
      return `${label} ${rule.value1}`;
    case 'between':
      return `${label} ${rule.value1} 和 ${rule.value2}`;
    case 'containsText':
    case 'notContainsText':
      return `${label} "${rule.value1}"`;
    case 'topN':
    case 'bottomN':
      return `${label} ${rule.n}`;
    case 'dataBar':
      return `${label}`;
    case 'twoColorScale':
    case 'threeColorScale':
      return `${label}`;
    default:
      return label;
  }
};

const createEmptyRule = (type: ConditionalFormatRuleType): ConditionalFormatRule => {
  const base: ConditionalFormatRule = { type };
  const option = RULE_TYPE_OPTIONS.find(o => o.value === type);
  
  if (option?.needsValue1) base.value1 = '';
  if (option?.needsValue2) base.value2 = '';
  if (option?.needsN) base.n = 10;
  if (option?.needsBarColor) base.barColor = '#4a86e8';
  if (option?.needsColors) {
    base.minColor = '#ffffff';
    base.maxColor = '#4a86e8';
    if (type === 'threeColorScale') {
      base.midColor = '#ffff00';
    }
  }
  
  return base;
};

const createEmptyStyle = (): ConditionalFormatStyle => ({
  fontColor: undefined,
  bgColor: undefined,
  bold: false,
  italic: false
});

export const ConditionalFormatPanel: React.FC<ConditionalFormatPanelProps> = ({ isOpen, onClose }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showRuleTypeMenu, setShowRuleTypeMenu] = useState(false);
  const [editingRule, setEditingRule] = useState<ConditionalFormatRule | null>(null);
  const [editingStyle, setEditingStyle] = useState<ConditionalFormatStyle>(createEmptyStyle());
  const [editingRange, setEditingRange] = useState('');
  const [showFontColorPicker, setShowFontColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  const workbookId = useSpreadsheetStore(state => state.workbookId);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const conditionalFormats = useSpreadsheetStore(state => state.conditionalFormats);
  const selectedCell = useSpreadsheetStore(state => state.selectedCell);
  const addConditionalFormat = useSpreadsheetStore(state => state.addConditionalFormat);
  const updateConditionalFormat = useSpreadsheetStore(state => state.updateConditionalFormat);
  const deleteConditionalFormat = useSpreadsheetStore(state => state.deleteConditionalFormat);

  const sheetFormats = conditionalFormats
    .filter(f => f.sheetId === activeSheetId)
    .sort((a, b) => a.priority - b.priority);

  useEffect(() => {
    if (isOpen && selectedCell && !editingId) {
      setEditingRange(selectedCell);
    }
  }, [isOpen, selectedCell, editingId]);

  const handleAddNew = () => {
    setEditingId('new');
    setEditingRule(createEmptyRule('greaterThan'));
    setEditingStyle(createEmptyStyle());
    setEditingRange(selectedCell || 'A1:A10');
  };

  const handleEdit = (format: ConditionalFormat) => {
    setEditingId(format.id);
    setEditingRule({ ...format.rule });
    setEditingStyle({ ...format.style });
    setEditingRange(format.rangeRef);
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingRule(null);
    setEditingStyle(createEmptyStyle());
    setEditingRange('');
    setShowRuleTypeMenu(false);
    setShowFontColorPicker(false);
    setShowBgColorPicker(false);
  };

  const handleSave = async () => {
    if (!workbookId || !editingRule) return;

    const formatData: Omit<ConditionalFormat, 'id'> = {
      workbookId,
      sheetId: activeSheetId,
      rangeRef: editingRange,
      rule: editingRule,
      style: editingStyle,
      priority: editingId === 'new' 
        ? (sheetFormats.length > 0 ? Math.max(...sheetFormats.map(f => f.priority)) + 1 : 0)
        : sheetFormats.find(f => f.id === editingId)?.priority || 0
    };

    if (editingId === 'new') {
      await addConditionalFormat(formatData);
    } else {
      await updateConditionalFormat(editingId, formatData);
    }

    handleCancel();
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除此条件格式规则吗？')) {
      await deleteConditionalFormat(id);
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const formats = [...sheetFormats];
    const temp = formats[index].priority;
    formats[index].priority = formats[index - 1].priority;
    formats[index - 1].priority = temp;
    
    await updateConditionalFormat(formats[index].id, { priority: formats[index].priority });
    await updateConditionalFormat(formats[index - 1].id, { priority: formats[index - 1].priority });
  };

  const handleMoveDown = async (index: number) => {
    if (index >= sheetFormats.length - 1) return;
    const formats = [...sheetFormats];
    const temp = formats[index].priority;
    formats[index].priority = formats[index + 1].priority;
    formats[index + 1].priority = temp;
    
    await updateConditionalFormat(formats[index].id, { priority: formats[index].priority });
    await updateConditionalFormat(formats[index + 1].id, { priority: formats[index + 1].priority });
  };

  const handleRuleTypeChange = (type: ConditionalFormatRuleType) => {
    setEditingRule(createEmptyRule(type));
    setShowRuleTypeMenu(false);
  };

  const handleStyleToggle = (key: 'bold' | 'italic') => {
    setEditingStyle(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleColorChange = (key: 'fontColor' | 'bgColor', color: string) => {
    setEditingStyle(prev => ({
      ...prev,
      [key]: color
    }));
    if (key === 'fontColor') setShowFontColorPicker(false);
    if (key === 'bgColor') setShowBgColorPicker(false);
  };

  const handleRuleColorChange = (key: 'minColor' | 'maxColor' | 'midColor' | 'barColor', color: string) => {
    if (editingRule) {
      setEditingRule(prev => prev ? { ...prev, [key]: color } : null);
    }
  };

  const getCurrentRuleOption = (): RuleTypeOption | undefined => {
    if (!editingRule) return undefined;
    return RULE_TYPE_OPTIONS.find(o => o.value === editingRule.type);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800">条件格式</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded transition-colors text-gray-500"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {editingId ? (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">规则类型</label>
              <div className="relative">
                <button
                  onClick={() => setShowRuleTypeMenu(!showRuleTypeMenu)}
                  className="w-full px-3 py-2 text-left text-sm border border-gray-300 rounded-md hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
                >
                  <span>{editingRule ? getRuleTypeLabel(editingRule.type) : '选择类型'}</span>
                  <ChevronDownIcon size={14} className="text-gray-400" />
                </button>
                {showRuleTypeMenu && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 max-h-60 overflow-y-auto">
                    {RULE_TYPE_OPTIONS.map(option => (
                      <button
                        key={option.value}
                        onClick={() => handleRuleTypeChange(option.value)}
                        className={cn(
                          "w-full px-3 py-2 text-left text-sm hover:bg-gray-50",
                          editingRule?.type === option.value ? "bg-blue-50 text-blue-700" : "text-gray-700"
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {getCurrentRuleOption()?.needsValue1 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">值 1</label>
                <input
                  type="text"
                  value={editingRule?.value1 || ''}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, value1: e.target.value } : null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入值"
                />
              </div>
            )}

            {getCurrentRuleOption()?.needsValue2 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">值 2</label>
                <input
                  type="text"
                  value={editingRule?.value2 || ''}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, value2: e.target.value } : null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="输入值"
                />
              </div>
            )}

            {getCurrentRuleOption()?.needsN && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">N 值</label>
                <input
                  type="number"
                  min="1"
                  value={editingRule?.n || 10}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, n: parseInt(e.target.value) || 10 } : null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {getCurrentRuleOption()?.needsBarColor && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">数据条颜色</label>
                <div className="flex items-center gap-2">
                  <div className="grid grid-cols-8 gap-1">
                    {PRESET_COLORS.slice(0, 16).map(color => (
                      <button
                        key={color}
                        onClick={() => handleRuleColorChange('barColor', color)}
                        className={cn(
                          "w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform",
                          editingRule?.barColor === color && "ring-2 ring-blue-500"
                        )}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={editingRule?.barColor || '#4a86e8'}
                    onChange={(e) => handleRuleColorChange('barColor', e.target.value)}
                    className="w-8 h-8 cursor-pointer rounded"
                  />
                </div>
              </div>
            )}

            {getCurrentRuleOption()?.needsColors && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">最小值颜色</label>
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-8 gap-1">
                      {PRESET_COLORS.slice(0, 16).map(color => (
                        <button
                          key={color}
                          onClick={() => handleRuleColorChange('minColor', color)}
                          className={cn(
                            "w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform",
                            editingRule?.minColor === color && "ring-2 ring-blue-500"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={editingRule?.minColor || '#ffffff'}
                      onChange={(e) => handleRuleColorChange('minColor', e.target.value)}
                      className="w-8 h-8 cursor-pointer rounded"
                    />
                  </div>
                </div>

                {editingRule?.type === 'threeColorScale' && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">中间值颜色</label>
                    <div className="flex items-center gap-2">
                      <div className="grid grid-cols-8 gap-1">
                        {PRESET_COLORS.slice(0, 16).map(color => (
                          <button
                            key={color}
                            onClick={() => handleRuleColorChange('midColor', color)}
                            className={cn(
                              "w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform",
                              editingRule?.midColor === color && "ring-2 ring-blue-500"
                            )}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={editingRule?.midColor || '#ffff00'}
                        onChange={(e) => handleRuleColorChange('midColor', e.target.value)}
                        className="w-8 h-8 cursor-pointer rounded"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">最大值颜色</label>
                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-8 gap-1">
                      {PRESET_COLORS.slice(0, 16).map(color => (
                        <button
                          key={color}
                          onClick={() => handleRuleColorChange('maxColor', color)}
                          className={cn(
                            "w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform",
                            editingRule?.maxColor === color && "ring-2 ring-blue-500"
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <input
                      type="color"
                      value={editingRule?.maxColor || '#4a86e8'}
                      onChange={(e) => handleRuleColorChange('maxColor', e.target.value)}
                      className="w-8 h-8 cursor-pointer rounded"
                    />
                  </div>
                </div>
              </div>
            )}

            {!getCurrentRuleOption()?.isColorScale && !getCurrentRuleOption()?.needsBarColor && (
              <>
                <div className="border-t border-gray-100 pt-4">
                  <label className="block text-xs font-medium text-gray-600 mb-2">样式</label>
                  <div className="flex items-center gap-2 mb-3">
                    <button
                      onClick={() => handleStyleToggle('bold')}
                      className={cn(
                        "p-2 rounded transition-colors",
                        editingStyle.bold ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
                      )}
                      title="加粗"
                    >
                      <Bold size={16} />
                    </button>
                    <button
                      onClick={() => handleStyleToggle('italic')}
                      className={cn(
                        "p-2 rounded transition-colors",
                        editingStyle.italic ? "bg-blue-100 text-blue-700" : "hover:bg-gray-100 text-gray-700"
                      )}
                      title="斜体"
                    >
                      <Italic size={16} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <button
                        onClick={() => setShowFontColorPicker(!showFontColorPicker)}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:border-gray-400 w-full"
                      >
                        <Type size={14} />
                        <span className="flex-1 text-left">字体颜色</span>
                        <div 
                          className="w-5 h-5 rounded border border-gray-300"
                          style={{ backgroundColor: editingStyle.fontColor || '#000000' }}
                        />
                      </button>
                      {showFontColorPicker && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                          <div className="grid grid-cols-8 gap-1">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => handleColorChange('fontColor', color)}
                                className={cn(
                                  "w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform",
                                  editingStyle.fontColor === color && "ring-2 ring-blue-500"
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="color"
                              value={editingStyle.fontColor || '#000000'}
                              onChange={(e) => handleColorChange('fontColor', e.target.value)}
                              className="w-8 h-8 cursor-pointer rounded"
                            />
                            <button
                              onClick={() => handleColorChange('fontColor', undefined as any)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              清除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => setShowBgColorPicker(!showBgColorPicker)}
                        className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-md hover:border-gray-400 w-full"
                      >
                        <Paintbrush size={14} />
                        <span className="flex-1 text-left">背景颜色</span>
                        <div 
                          className="w-5 h-5 rounded border border-gray-300"
                          style={{ backgroundColor: editingStyle.bgColor || '#ffffff' }}
                        />
                      </button>
                      {showBgColorPicker && (
                        <div className="absolute top-full left-0 mt-1 p-2 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                          <div className="grid grid-cols-8 gap-1">
                            {PRESET_COLORS.map(color => (
                              <button
                                key={color}
                                onClick={() => handleColorChange('bgColor', color)}
                                className={cn(
                                  "w-5 h-5 rounded border border-gray-200 hover:scale-110 transition-transform",
                                  editingStyle.bgColor === color && "ring-2 ring-blue-500"
                                )}
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <input
                              type="color"
                              value={editingStyle.bgColor || '#ffffff'}
                              onChange={(e) => handleColorChange('bgColor', e.target.value)}
                              className="w-8 h-8 cursor-pointer rounded"
                            />
                            <button
                              onClick={() => handleColorChange('bgColor', undefined as any)}
                              className="text-xs text-gray-500 hover:text-gray-700"
                            >
                              清除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="border-t border-gray-100 pt-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">应用范围</label>
              <input
                type="text"
                value={editingRange}
                onChange={(e) => setEditingRange(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                placeholder="例如: A1:A10 或 Sheet2!A1:B5"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleCancel}
                className="flex-1 px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-gray-700 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!editingRule || !editingRange}
                className="flex-1 px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                保存
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4">
            <button
              onClick={handleAddNew}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors mb-4"
            >
              <Plus size={16} />
              添加新规则
            </button>

            {sheetFormats.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-sm">
                暂无条件格式规则
              </div>
            ) : (
              <div className="space-y-2">
                {sheetFormats.map((format, index) => (
                  <div
                    key={format.id}
                    className="border border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">
                          {getRuleDescription(format.rule)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 font-mono">
                          {format.rangeRef}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          {format.style.bold && (
                            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">B</span>
                          )}
                          {format.style.italic && (
                            <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded italic">I</span>
                          )}
                          {format.style.fontColor && (
                            <div 
                              className="w-4 h-4 rounded border border-gray-200"
                              style={{ backgroundColor: format.style.fontColor }}
                              title="字体颜色"
                            />
                          )}
                          {format.style.bgColor && (
                            <div 
                              className="w-4 h-4 rounded border border-gray-200"
                              style={{ backgroundColor: format.style.bgColor }}
                              title="背景颜色"
                            />
                          )}
                          {format.rule.barColor && (
                            <div 
                              className="w-8 h-3 rounded"
                              style={{ backgroundColor: format.rule.barColor }}
                              title="数据条颜色"
                            />
                          )}
                          {format.rule.minColor && format.rule.maxColor && (
                            <div 
                              className="w-8 h-3 rounded"
                              style={{ 
                                background: format.rule.midColor 
                                  ? `linear-gradient(to right, ${format.rule.minColor}, ${format.rule.midColor}, ${format.rule.maxColor})`
                                  : `linear-gradient(to right, ${format.rule.minColor}, ${format.rule.maxColor})`
                              }}
                              title="色阶"
                            />
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className={cn(
                            "p-1 rounded transition-colors",
                            index === 0 ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-100 text-gray-500"
                          )}
                          title="上移"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button
                          onClick={() => handleMoveDown(index)}
                          disabled={index === sheetFormats.length - 1}
                          className={cn(
                            "p-1 rounded transition-colors",
                            index === sheetFormats.length - 1 ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-100 text-gray-500"
                          )}
                          title="下移"
                        >
                          <ChevronDown size={16} />
                        </button>
                        <button
                          onClick={() => handleEdit(format)}
                          className="p-1 hover:bg-gray-100 rounded text-gray-500 hover:text-blue-600 transition-colors"
                          title="编辑"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          onClick={() => handleDelete(format.id)}
                          className="p-1 hover:bg-red-50 rounded text-gray-500 hover:text-red-600 transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-gray-400 mt-2">
                      优先级: {format.priority}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
