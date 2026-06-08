import React from 'react';
import { X, Undo2, Redo2, Clock, User, Hash, History, ArrowLeftCircle } from 'lucide-react';
import type { Operation, OperationType } from '../../../shared/types';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';

interface HistoryPanelProps {
  onClose: () => void;
}

const OPERATION_LABELS: Record<OperationType, { label: string; color: string }> = {
  cellUpdate: { label: '单元格编辑', color: 'bg-blue-100 text-blue-700' },
  cellFormatUpdate: { label: '格式更新', color: 'bg-purple-100 text-purple-700' },
  sheetCreate: { label: '新建工作表', color: 'bg-green-100 text-green-700' },
  sheetRename: { label: '重命名工作表', color: 'bg-yellow-100 text-yellow-700' },
  sheetDelete: { label: '删除工作表', color: 'bg-red-100 text-red-700' },
  sheetReorder: { label: '排序工作表', color: 'bg-orange-100 text-orange-700' },
  sheetCopy: { label: '复制工作表', color: 'bg-teal-100 text-teal-700' },
  conditionalFormatAdd: { label: '添加条件格式', color: 'bg-pink-100 text-pink-700' },
  conditionalFormatRemove: { label: '删除条件格式', color: 'bg-rose-100 text-rose-700' },
  conditionalFormatUpdate: { label: '更新条件格式', color: 'bg-fuchsia-100 text-fuchsia-700' },
  chartAdd: { label: '添加图表', color: 'bg-indigo-100 text-indigo-700' },
  chartRemove: { label: '删除图表', color: 'bg-red-100 text-red-700' },
  chartUpdate: { label: '更新图表', color: 'bg-cyan-100 text-cyan-700' }
};

const formatTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getOperationInfo = (type: OperationType) => {
  return OPERATION_LABELS[type] || { label: type, color: 'bg-gray-100 text-gray-700' };
};

const getOperationPayloadSummary = (operation: Operation): string => {
  const payload = operation.payload as Record<string, unknown>;
  
  switch (operation.type) {
    case 'cellUpdate':
      return `单元格 ${payload.cellId}: ${(payload.rawValue as string) || '(空)'}`;
    case 'cellFormatUpdate':
      return `单元格 ${payload.cellId}`;
    case 'sheetCreate':
      return `工作表: ${(payload.sheet as { name: string })?.name || (payload.name as string)}`;
    case 'sheetRename':
      return `重命名为: ${payload.name}`;
    case 'sheetDelete':
      return `工作表 ID: ${payload.sheetId}`;
    case 'sheetReorder':
      return `移动到位置: ${(payload.newIndex as number) + 1}`;
    case 'sheetCopy':
      return `源工作表: ${payload.sourceSheetId}`;
    case 'chartAdd':
    case 'chartUpdate':
      return `图表: ${(payload.chart as { options?: { title?: string } })?.options?.title || (payload.rangeRef as string) || '未命名'}`;
    case 'chartRemove':
      return `图表 ID: ${payload.id}`;
    case 'conditionalFormatAdd':
      return `范围: ${(payload.format as { rangeRef?: string })?.rangeRef}`;
    case 'conditionalFormatRemove':
      return `格式 ID: ${payload.id}`;
    default:
      return '';
  }
};

export const HistoryPanel: React.FC<HistoryPanelProps> = ({ onClose }) => {
  const history = useSpreadsheetStore(state => state.history);
  const undoStack = useSpreadsheetStore(state => state.undoStack);
  const redoStack = useSpreadsheetStore(state => state.redoStack);
  const version = useSpreadsheetStore(state => state.version);
  const historyIndex = useSpreadsheetStore(state => state.historyIndex);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const undo = useSpreadsheetStore(state => state.undo);
  const redo = useSpreadsheetStore(state => state.redo);
  const jumpToVersion = useSpreadsheetStore(state => state.jumpToVersion);

  const getSheetName = (sheetId: string): string => {
    const sheet = sheets.find(s => s.id === sheetId);
    return sheet?.name || '未知工作表';
  };

  const handleJumpToVersion = (index: number) => {
    if (confirm(`确定要跳转到该历史版本吗？当前未保存的更改可能会丢失。`)) {
      jumpToVersion(index);
    }
  };

  const canUndo = undoStack.length > 0;
  const canRedo = redoStack.length > 0;

  return (
    <div className="w-[280px] bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">历史记录</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={undo}
            disabled={!canUndo}
            className={`p-1.5 rounded transition-colors ${
              canUndo
                ? 'hover:bg-gray-100 text-gray-600'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title={`撤销 (${undoStack.length})`}
          >
            <Undo2 size={16} />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo}
            className={`p-1.5 rounded transition-colors ${
              canRedo
                ? 'hover:bg-gray-100 text-gray-600'
                : 'text-gray-300 cursor-not-allowed'
            }`}
            title={`重做 (${redoStack.length})`}
          >
            <Redo2 size={16} />
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

      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-gray-500" />
            <span className="text-sm font-medium text-gray-700">
              当前版本: v{version}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <History size={12} />
            <span>历史记录: {history.length} 条</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={canUndo ? 'text-blue-500' : 'text-gray-300'}>
              撤销: {undoStack.length}
            </span>
            <span className={canRedo ? 'text-green-500' : 'text-gray-300'}>
              重做: {redoStack.length}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <Clock size={32} className="mb-2 opacity-50" />
            <p>暂无历史记录</p>
            <p className="text-xs mt-1">开始编辑后将记录操作历史</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map((operation, index) => {
              const opInfo = getOperationInfo(operation.type);
              const isCurrentVersion = historyIndex === history.length - index - 1;
              
              return (
                <div
                  key={operation.id}
                  className={`
                    group relative p-3 bg-white border rounded-lg transition-all cursor-pointer
                    ${isCurrentVersion
                      ? 'border-blue-300 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-200 hover:shadow-sm'
                    }
                  `}
                  onClick={() => handleJumpToVersion(history.length - index - 1)}
                >
                  <div className="flex items-start gap-3">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${opInfo.color}
                    `}>
                      <span className="text-xs font-bold">
                        {opInfo.label.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm font-medium ${isCurrentVersion ? 'text-blue-700' : 'text-gray-800'}`}>
                          {opInfo.label}
                        </span>
                        {isCurrentVersion && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-blue-500 text-white rounded">
                            当前
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 truncate">
                        {getOperationPayloadSummary(operation)}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <div className="flex items-center gap-1">
                          <User size={10} />
                          <span>{operation.userName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock size={10} />
                          <span>{formatTime(operation.timestamp)}</span>
                        </div>
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        工作表: {getSheetName(operation.sheetId)}
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <ArrowLeftCircle size={16} className="text-blue-500" />
                    </div>
                  </div>
                  
                  <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-gray-300" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        <div className="flex items-center justify-between">
          <span>历史记录限制: 100条</span>
          <span className="text-gray-400">
            v{version} · {history.length} 操作
          </span>
        </div>
      </div>
    </div>
  );
};
