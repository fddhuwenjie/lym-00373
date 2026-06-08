import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, BarChart3, LineChart, PieChart, GitBranch, Settings, Check } from 'lucide-react';
import type { Chart, ChartType } from '../../../shared/types';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';

interface ChartsPanelProps {
  onClose: () => void;
}

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  { type: 'bar', label: '柱状图', icon: <BarChart3 size={18} /> },
  { type: 'line', label: '折线图', icon: <LineChart size={18} /> },
  { type: 'pie', label: '饼图', icon: <PieChart size={18} /> },
  { type: 'scatter', label: '散点图', icon: <GitBranch size={18} /> }
];

const CHART_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

export const ChartsPanel: React.FC<ChartsPanelProps> = ({ onClose }) => {
  const charts = useSpreadsheetStore(state => state.charts);
  const sheets = useSpreadsheetStore(state => state.sheets);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const workbookId = useSpreadsheetStore(state => state.workbookId);
  const addChart = useSpreadsheetStore(state => state.addChart);
  const updateChart = useSpreadsheetStore(state => state.updateChart);
  const deleteChart = useSpreadsheetStore(state => state.deleteChart);

  const [showAddForm, setShowAddForm] = useState(false);
  const [editingChart, setEditingChart] = useState<Chart | null>(null);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [rangeRef, setRangeRef] = useState('');
  const [title, setTitle] = useState('');
  const [xAxisTitle, setXAxisTitle] = useState('');
  const [yAxisTitle, setYAxisTitle] = useState('');
  const [showLegend, setShowLegend] = useState(true);

  const resetForm = () => {
    setChartType('bar');
    setRangeRef('');
    setTitle('');
    setXAxisTitle('');
    setYAxisTitle('');
    setShowLegend(true);
    setShowAddForm(false);
    setEditingChart(null);
  };

  const handleStartEdit = (chart: Chart) => {
    setEditingChart(chart);
    setChartType(chart.type);
    setRangeRef(chart.rangeRef);
    setTitle(chart.options.title || '');
    setXAxisTitle(chart.options.xAxisTitle || '');
    setYAxisTitle(chart.options.yAxisTitle || '');
    setShowLegend(chart.options.showLegend ?? true);
    setShowAddForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rangeRef.trim() || !workbookId) return;

    const chartData = {
      workbookId,
      sheetId: activeSheetId,
      rangeRef: rangeRef.trim(),
      type: chartType,
      options: {
        title: title.trim() || undefined,
        xAxisTitle: xAxisTitle.trim() || undefined,
        yAxisTitle: yAxisTitle.trim() || undefined,
        showLegend,
        colors: CHART_COLORS
      }
    };

    if (editingChart) {
      await updateChart(editingChart.id, chartData);
    } else {
      await addChart(chartData);
    }

    resetForm();
  };

  const handleDelete = async (chartId: string) => {
    if (confirm('确定要删除这个图表吗？')) {
      await deleteChart(chartId);
    }
  };

  const getChartIcon = (type: ChartType) => {
    const chartInfo = CHART_TYPES.find(c => c.type === type);
    return chartInfo?.icon || <BarChart3 size={18} />;
  };

  const getChartTypeName = (type: ChartType) => {
    const chartInfo = CHART_TYPES.find(c => c.type === type);
    return chartInfo?.label || type;
  };

  const getSheetName = (sheetId: string) => {
    const sheet = sheets.find(s => s.id === sheetId);
    return sheet?.name || '未知工作表';
  };

  return (
    <div className="w-[280px] bg-white border-l border-gray-200 flex flex-col h-full shadow-lg">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h3 className="font-semibold text-gray-800 text-sm">图表管理</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-600"
            title="新建图表"
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

      {showAddForm && (
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {editingChart ? '编辑图表' : '新建图表'}
          </h4>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">图表类型</label>
              <div className="grid grid-cols-4 gap-1">
                {CHART_TYPES.map(({ type, label, icon }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setChartType(type)}
                    className={`
                      flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all
                      ${chartType === type
                        ? 'border-blue-500 bg-blue-50 text-blue-600'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}
                    `}
                    title={label}
                  >
                    {icon}
                    <span className="text-[10px]">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">数据范围</label>
              <input
                type="text"
                value={rangeRef}
                onChange={(e) => setRangeRef(e.target.value)}
                placeholder="例如: A1:B10"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs text-gray-500 mb-1">图表标题</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="可选"
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">X轴标题</label>
                <input
                  type="text"
                  value={xAxisTitle}
                  onChange={(e) => setXAxisTitle(e.target.value)}
                  placeholder="可选"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Y轴标题</label>
                <input
                  type="text"
                  value={yAxisTitle}
                  onChange={(e) => setYAxisTitle(e.target.value)}
                  placeholder="可选"
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="showLegend"
                checked={showLegend}
                onChange={(e) => setShowLegend(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="showLegend" className="text-xs text-gray-600">显示图例</label>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
              >
                <Check size={14} />
                {editingChart ? '保存' : '创建'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        {charts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm">
            <BarChart3 size={32} className="mb-2 opacity-50" />
            <p>暂无图表</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-2 text-blue-500 hover:text-blue-600"
            >
              创建第一个图表
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {charts.map((chart) => (
              <div
                key={chart.id}
                className="group p-3 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                    {getChartIcon(chart.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">
                      {chart.options.title || '未命名图表'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {getChartTypeName(chart.type)} · {chart.rangeRef}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      工作表: {getSheetName(chart.sheetId)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(chart);
                      }}
                      className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500"
                      title="编辑"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(chart.id);
                      }}
                      className="p-1.5 hover:bg-red-100 rounded transition-colors text-gray-500 hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {chart.options.title && (
                  <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                    <Settings size={12} className="text-gray-400" />
                    <div className="flex flex-wrap gap-1">
                      {chart.options.xAxisTitle && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          X: {chart.options.xAxisTitle}
                        </span>
                      )}
                      {chart.options.yAxisTitle && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          Y: {chart.options.yAxisTitle}
                        </span>
                      )}
                      {chart.options.showLegend && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded">
                          图例
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
        共 {charts.length} 个图表
      </div>
    </div>
  );
};
