import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell
} from 'recharts';
import type { Chart } from '../../shared/types';
import { useSpreadsheetStore } from '../store/useSpreadsheetStore';

interface ChartComponentProps {
  chart: Chart;
  onClose?: () => void;
}

interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

const DEFAULT_COLORS = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16'
];

const parseRangeRef = (rangeRef: string): { startCol: number; startRow: number; endCol: number; endRow: number } => {
  const match = rangeRef.match(/^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i);
  if (!match) {
    return { startCol: 0, startRow: 0, endCol: 0, endRow: 0 };
  }

  const colToIndex = (col: string): number => {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.toUpperCase().charCodeAt(i) - 64);
    }
    return index - 1;
  };

  return {
    startCol: colToIndex(match[1]),
    startRow: parseInt(match[2]) - 1,
    endCol: colToIndex(match[3]),
    endRow: parseInt(match[4]) - 1
  };
};

const indexToCellId = (col: number, row: number): string => {
  let colStr = '';
  let n = col;
  while (n >= 0) {
    colStr = String.fromCharCode((n % 26) + 65) + colStr;
    n = Math.floor(n / 26) - 1;
  }
  return `${colStr}${row + 1}`;
};

export const ChartComponent: React.FC<ChartComponentProps> = ({ chart, onClose }) => {
  const sheets = useSpreadsheetStore(state => state.sheets);

  const chartData = useMemo((): ChartDataPoint[] => {
    const sheet = sheets.find(s => s.id === chart.sheetId);
    if (!sheet) return [];

    const { startCol, startRow, endCol, endRow } = parseRangeRef(chart.rangeRef);
    const data: ChartDataPoint[] = [];

    if (chart.type === 'pie') {
      for (let row = startRow; row <= endRow; row++) {
        const labelCellId = indexToCellId(startCol, row);
        const valueCellId = indexToCellId(startCol + 1, row);
        const labelCell = sheet.cells[labelCellId];
        const valueCell = sheet.cells[valueCellId];
        
        const label = labelCell?.value?.toString() || labelCellId;
        const value = parseFloat(valueCell?.value?.toString() || '0');
        
        if (!isNaN(value)) {
          data.push({ name: label, value });
        }
      }
    } else {
      const dataColumns = endCol - startCol;
      for (let row = startRow + 1; row <= endRow; row++) {
        const point: ChartDataPoint = { name: '', value: 0 };
        
        for (let col = startCol; col <= endCol; col++) {
          const cellId = indexToCellId(col, row);
          const headerCellId = indexToCellId(col, startRow);
          const headerCell = sheet.cells[headerCellId];
          const cell = sheet.cells[cellId];
          
          const key = headerCell?.value?.toString() || indexToCellId(col, 0);
          
          if (col === startCol) {
            point.name = cell?.value?.toString() || cellId;
          } else {
            const value = parseFloat(cell?.value?.toString() || '0');
            point[key] = isNaN(value) ? 0 : value;
          }
        }
        
        data.push(point);
      }
    }

    return data;
  }, [chart.rangeRef, chart.sheetId, chart.type, sheets]);

  const dataKeys = useMemo(() => {
    if (chartData.length === 0) return [];
    return Object.keys(chartData[0]).filter(key => key !== 'name' && key !== 'value');
  }, [chartData]);

  const colors = chart.options.colors || DEFAULT_COLORS;

  const renderChart = () => {
    if (chartData.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-gray-400">
          <p>没有数据可显示</p>
        </div>
      );
    }

    const commonProps = {
      data: chartData,
      margin: { top: 20, right: 30, left: 20, bottom: 20 }
    };

    switch (chart.type) {
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            {chart.options.showLegend !== false && <Legend />}
            {dataKeys.map((key, index) => (
              <Bar
                key={key}
                dataKey={key}
                fill={colors[index % colors.length]}
                name={key}
              />
            ))}
          </BarChart>
        );

      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            {chart.options.showLegend !== false && <Legend />}
            {dataKeys.map((key, index) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={colors[index % colors.length]}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name={key}
              />
            ))}
          </LineChart>
        );

      case 'pie':
        return (
          <PieChart {...commonProps}>
            <Tooltip />
            {chart.options.showLegend !== false && <Legend />}
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={Math.min(commonProps.margin.top !== undefined ? 100 : 80, 80)}
              label
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
          </PieChart>
        );

      case 'scatter':
        return (
          <ScatterChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey={dataKeys[0] || 'x'}
              name={chart.options.xAxisTitle || 'X'}
              type="number"
            />
            <YAxis
              dataKey={dataKeys[1] || 'y'}
              name={chart.options.yAxisTitle || 'Y'}
              type="number"
            />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            {chart.options.showLegend !== false && <Legend />}
            <Scatter name="数据点" data={chartData} fill={colors[0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Scatter>
          </ScatterChart>
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {chart.options.title && (
        <div className="px-4 py-2 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-800 text-center">
            {chart.options.title}
          </h3>
        </div>
      )}
      <div className="flex-1 p-2">
        <ResponsiveContainer width="100%" height="100%">
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  );
};
