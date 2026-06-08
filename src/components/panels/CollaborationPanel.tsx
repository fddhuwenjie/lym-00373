import React, { useState, useEffect } from 'react';
import { X, Users, Wifi, WifiOff, Clock, MapPin, RefreshCw, User, Settings } from 'lucide-react';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';

interface CollaborationPanelProps {
  onClose: () => void;
}

interface CollaboratorDisplay {
  userId: string;
  name: string;
  color: string;
  sheetId: string;
  cellId: string;
  lastActive: number;
  connectedAt: number;
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  } else if (minutes > 0) {
    return `${minutes}分钟`;
  } else {
    return `${seconds}秒`;
  }
};

const formatLastActive = (timestamp: number): string => {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);

  if (seconds < 5) {
    return '正在编辑';
  } else if (seconds < 60) {
    return `${seconds}秒前`;
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}分钟前`;
  } else {
    return `${Math.floor(seconds / 3600)}小时前`;
  }
};

const getStatusColor = (lastActive: number): string => {
  const diff = Date.now() - lastActive;
  if (diff < 10000) return 'bg-green-500';
  if (diff < 60000) return 'bg-yellow-500';
  return 'bg-gray-400';
};

export const CollaborationPanel: React.FC<CollaborationPanelProps> = ({ onClose }) => {
  const collaborators = useSpreadsheetStore(state => state.collaborators);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const wsConnected = useSpreadsheetStore(state => state.wsConnected);
  const userId = useSpreadsheetStore(state => state.userId);
  const userName = useSpreadsheetStore(state => state.userName);
  const userColor = useSpreadsheetStore(state => state.userColor);
  const selectedCell = useSpreadsheetStore(state => state.selectedCell);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const connectWebSocket = useSpreadsheetStore(state => state.connectWebSocket);
  const disconnectWebSocket = useSpreadsheetStore(state => state.disconnectWebSocket);
  const workbookId = useSpreadsheetStore(state => state.workbookId);
  const version = useSpreadsheetStore(state => state.version);

  const [connectionTimes, setConnectionTimes] = useState<Record<string, number>>({});
  const [, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const newConnectionTimes: Record<string, number> = {};
    Object.keys(collaborators).forEach(id => {
      if (!connectionTimes[id]) {
        newConnectionTimes[id] = Date.now();
      }
    });
    if (Object.keys(newConnectionTimes).length > 0) {
      setConnectionTimes(prev => ({ ...prev, ...newConnectionTimes }));
    }
  }, [Object.keys(collaborators).join(',')]);

  const getSheetName = (sheetId: string): string => {
    const sheet = sheets.find(s => s.id === sheetId);
    return sheet?.name || '未知工作表';
  };

  const collaboratorList: CollaboratorDisplay[] = [
    {
      userId,
      name: `${userName} (你)`,
      color: userColor,
      sheetId: activeSheetId,
      cellId: selectedCell || 'A1',
      lastActive: Date.now(),
      connectedAt: connectionTimes[userId] || Date.now()
    },
    ...Object.entries(collaborators)
      .filter(([id]) => id !== userId)
      .map(([id, collab]) => ({
        userId: id,
        name: collab.name,
        color: collab.color,
        sheetId: collab.sheetId,
        cellId: collab.cellId,
        lastActive: collab.lastActive,
        connectedAt: connectionTimes[id] || Date.now()
      }))
  ];

  const handleReconnect = () => {
    if (workbookId) {
      disconnectWebSocket();
      setTimeout(() => connectWebSocket(workbookId), 500);
    }
  };

  const getSyncStatus = () => {
    if (!wsConnected) return { text: '未连接', color: 'text-red-500' };
    return { text: '已同步', color: 'text-green-500' };
  };

  const syncStatus = getSyncStatus();

  return (
    <div className="w-[280px] bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">协同编辑</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={handleReconnect}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
            title="重新连接"
          >
            <RefreshCw size={16} className={wsConnected ? '' : 'animate-spin'} />
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
            {wsConnected ? (
              <Wifi size={16} className="text-green-500" />
            ) : (
              <WifiOff size={16} className="text-red-500" />
            )}
            <span className="text-sm font-medium text-gray-700">
              {wsConnected ? '已连接' : '未连接'}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className={`${syncStatus.color} font-medium`}>{syncStatus.text}</span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Users size={12} />
            <span>在线: {collaboratorList.length} 人</span>
          </div>
          <div className="flex items-center gap-1">
            <Settings size={12} />
            <span>版本: v{version}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {collaboratorList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <Users size={32} className="mb-2 opacity-50" />
            <p>暂无协作者</p>
            <p className="text-xs mt-1">保存并分享文档以开始协作</p>
          </div>
        ) : (
          <div className="space-y-2">
            {collaboratorList.map((collab) => (
              <div
                key={collab.userId}
                className="p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-200 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="relative">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm"
                      style={{ backgroundColor: collab.color }}
                    >
                      {collab.name.charAt(0).toUpperCase()}
                    </div>
                    <div
                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${getStatusColor(collab.lastActive)}`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-800 truncate">
                        {collab.name}
                      </span>
                      <span
                        className="flex-shrink-0 w-2 h-2 rounded-full ml-2"
                        style={{ backgroundColor: collab.color }}
                      />
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                      <MapPin size={10} />
                      <span className="truncate">
                        {getSheetName(collab.sheetId)} · {collab.cellId}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <div className="flex items-center gap-1">
                        <Clock size={10} />
                        <span>{formatLastActive(collab.lastActive)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <User size={10} />
                        <span>已连接 {formatDuration(Date.now() - collab.connectedAt)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {collab.userId === userId && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-1 text-xs text-blue-500">
                      <Wifi size={10} />
                      <span>这是你当前的会话</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        {wsConnected ? (
          <div className="flex items-center justify-between">
            <span>实时同步已开启</span>
            <span className="text-green-500">● 在线</span>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span>离线模式</span>
            <span className="text-red-500">● 断开连接</span>
          </div>
        )}
      </div>
    </div>
  );
};
