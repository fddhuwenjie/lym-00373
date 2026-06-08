import type { Cell, ConditionalFormat, CellStyle } from '../../../shared/types';

export type NumberFormatType = 'general' | 'percent' | 'currency' | 'scientific' | 'thousands' | 'decimal';

export interface FormatOptions {
  decimals?: number;
  currencySymbol?: string;
}

export function formatNumber(value: unknown, formatType: NumberFormatType, options: FormatOptions = {}): string {
  if (value === null || value === undefined) return '';
  
  const numValue = typeof value === 'number' ? value : 
                   typeof value === 'string' ? parseFloat(value) : NaN;
  
  if (isNaN(numValue)) return String(value);
  
  const { decimals = 2, currencySymbol = '¥' } = options;
  
  switch (formatType) {
    case 'general':
      return String(numValue);
      
    case 'percent':
      return `${(numValue * 100).toFixed(decimals)}%`;
      
    case 'currency':
      return `${currencySymbol}${numValue.toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      })}`;
      
    case 'scientific':
      return numValue.toExponential(decimals);
      
    case 'thousands':
      return numValue.toLocaleString('zh-CN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
      
    case 'decimal':
      return numValue.toFixed(decimals);
      
    default:
      return String(numValue);
  }
}

export function parseNumberFormat(format: string): { type: NumberFormatType; options: FormatOptions } {
  const formatLower = format.toLowerCase();
  
  if (formatLower.includes('%')) {
    const decimalsMatch = format.match(/\.(\d+)/);
    return { type: 'percent', options: { decimals: decimalsMatch ? parseInt(decimalsMatch[1]) : 2 } };
  }
  
  if (formatLower.includes('¥') || formatLower.includes('$') || formatLower.includes('€')) {
    const symbol = format.includes('¥') ? '¥' : format.includes('$') ? '$' : '€';
    const decimalsMatch = format.match(/\.(\d+)/);
    return { type: 'currency', options: { decimals: decimalsMatch ? parseInt(decimalsMatch[1]) : 2, currencySymbol: symbol } };
  }
  
  if (formatLower.includes('e+') || formatLower.includes('e-')) {
    const decimalsMatch = format.match(/\.(\d+)/);
    return { type: 'scientific', options: { decimals: decimalsMatch ? parseInt(decimalsMatch[1]) : 2 } };
  }
  
  if (formatLower.includes('#,##0')) {
    const decimalsMatch = format.match(/\.(\d+)/);
    return { type: 'thousands', options: { decimals: decimalsMatch ? parseInt(decimalsMatch[1]) : 0 } };
  }
  
  if (formatLower.includes('0.0')) {
    const decimalsMatch = format.match(/\.(\d+)/);
    return { type: 'decimal', options: { decimals: decimalsMatch ? parseInt(decimalsMatch[1]) : 2 } };
  }
  
  return { type: 'general', options: {} };
}

export type ConditionalFormatRuleType = 
  | 'greaterThan'
  | 'lessThan'
  | 'between'
  | 'equalTo'
  | 'textContains'
  | 'duplicateValues'
  | 'topN'
  | 'bottomN'
  | 'dataBar'
  | 'colorScale2'
  | 'colorScale3';

export interface RuleEvaluationResult {
  match: boolean;
  style: Partial<CellStyle>;
}

function getCellNumericValue(cell: Cell): number {
  if (cell === null || cell === undefined) return NaN;
  const value = cell.value;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? NaN : parsed;
  }
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof Date) return value.getTime();
  return NaN;
}

function getCellStringValue(cell: Cell): string {
  if (cell === null || cell === undefined) return '';
  const value = cell.value;
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().split('T')[0];
  return String(value);
}

function evaluateComparisonRule(
  cell: Cell,
  ruleType: ConditionalFormatRuleType,
  params: Record<string, unknown>
): boolean {
  const numValue = getCellNumericValue(cell);
  
  switch (ruleType) {
    case 'greaterThan':
      return !isNaN(numValue) && numValue > (params.value as number);
      
    case 'lessThan':
      return !isNaN(numValue) && numValue < (params.value as number);
      
    case 'between':
      return !isNaN(numValue) && 
             numValue >= (params.min as number) && 
             numValue <= (params.max as number);
      
    case 'equalTo':
      if (typeof params.value === 'number') {
        return !isNaN(numValue) && numValue === params.value;
      }
      return getCellStringValue(cell) === String(params.value);
      
    case 'textContains':
      const text = getCellStringValue(cell).toLowerCase();
      const searchText = String(params.text || '').toLowerCase();
      return text.includes(searchText);
      
    default:
      return false;
  }
}

function evaluateDuplicateValues(cells: Cell[], cellIndex: number): boolean {
  const targetValue = getCellStringValue(cells[cellIndex]);
  if (!targetValue) return false;
  
  let count = 0;
  for (const cell of cells) {
    if (getCellStringValue(cell) === targetValue) {
      count++;
      if (count > 1) return true;
    }
  }
  return false;
}

function evaluateTopBottomN(
  cells: Cell[],
  cellIndex: number,
  n: number,
  isTop: boolean
): boolean {
  const values = cells.map(cell => ({
    index: cellIndex,
    value: getCellNumericValue(cell)
  })).filter(v => !isNaN(v.value));
  
  values.sort((a, b) => isTop ? b.value - a.value : a.value - b.value);
  
  const topNValues = new Set(values.slice(0, n).map(v => v.value));
  return topNValues.has(getCellNumericValue(cells[cellIndex]));
}

function evaluateDataBar(
  cell: Cell,
  cells: Cell[],
  params: Record<string, unknown>
): Partial<CellStyle> {
  const numValue = getCellNumericValue(cell);
  if (isNaN(numValue)) return {};
  
  const allValues = cells.map(c => getCellNumericValue(c)).filter(v => !isNaN(v));
  if (allValues.length === 0) return {};
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min;
  
  const percentage = range === 0 ? 100 : Math.max(0, Math.min(100, ((numValue - min) / range) * 100));
  const color = (params.color as string) || '#4CAF50';
  
  return {
    bgColor: `linear-gradient(to right, ${color} ${percentage}%, transparent ${percentage}%)`
  };
}

function evaluateColorScale2(
  cell: Cell,
  cells: Cell[],
  params: Record<string, unknown>
): Partial<CellStyle> {
  const numValue = getCellNumericValue(cell);
  if (isNaN(numValue)) return {};
  
  const allValues = cells.map(c => getCellNumericValue(c)).filter(v => !isNaN(v));
  if (allValues.length === 0) return {};
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min;
  
  const ratio = range === 0 ? 0.5 : Math.max(0, Math.min(1, (numValue - min) / range));
  
  const minColor = (params.minColor as string) || '#FFEB3B';
  const maxColor = (params.maxColor as string) || '#F44336';
  
  const bgColor = interpolateColor(minColor, maxColor, ratio);
  
  return { bgColor };
}

function evaluateColorScale3(
  cell: Cell,
  cells: Cell[],
  params: Record<string, unknown>
): Partial<CellStyle> {
  const numValue = getCellNumericValue(cell);
  if (isNaN(numValue)) return {};
  
  const allValues = cells.map(c => getCellNumericValue(c)).filter(v => !isNaN(v));
  if (allValues.length === 0) return {};
  
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const mid = (min + max) / 2;
  
  const minColor = (params.minColor as string) || '#F44336';
  const midColor = (params.midColor as string) || '#FFEB3B';
  const maxColor = (params.maxColor as string) || '#4CAF50';
  
  let bgColor: string;
  if (numValue <= mid) {
    const ratio = min === mid ? 0.5 : (numValue - min) / (mid - min);
    bgColor = interpolateColor(minColor, midColor, Math.max(0, Math.min(1, ratio)));
  } else {
    const ratio = max === mid ? 0.5 : (numValue - mid) / (max - mid);
    bgColor = interpolateColor(midColor, maxColor, Math.max(0, Math.min(1, ratio)));
  }
  
  return { bgColor };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function interpolateColor(color1: string, color2: string, ratio: number): string {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);
  
  return rgbToHex(r, g, b);
}

function parseRangeRef(rangeRef: string): { sheetId: string; startCellId: string; endCellId: string } {
  let sheetId = 'sheet1';
  let range = rangeRef;
  
  const exclIndex = rangeRef.indexOf('!');
  if (exclIndex !== -1) {
    sheetId = rangeRef.substring(0, exclIndex).replace(/^'|'$/g, '');
    range = rangeRef.substring(exclIndex + 1);
  }
  
  const [start, end] = range.split(':');
  return { sheetId, startCellId: start, endCellId: end || start };
}

function expandRangeRef(rangeRef: string): { sheetId: string; cellIds: string[] } {
  const { sheetId, startCellId, endCellId } = parseRangeRef(rangeRef);
  
  const startMatch = startCellId.match(/([A-Z])(\d+)/);
  const endMatch = endCellId.match(/([A-Z])(\d+)/);
  
  if (!startMatch || !endMatch) {
    return { sheetId, cellIds: [startCellId] };
  }
  
  const startCol = startMatch[1].charCodeAt(0) - 65;
  const startRow = parseInt(startMatch[2], 10);
  const endCol = endMatch[1].charCodeAt(0) - 65;
  const endRow = parseInt(endMatch[2], 10);
  
  const minCol = Math.min(startCol, endCol);
  const maxCol = Math.max(startCol, endCol);
  const minRow = Math.min(startRow, endRow);
  const maxRow = Math.max(startRow, endRow);
  
  const cellIds: string[] = [];
  for (let col = minCol; col <= maxCol; col++) {
    const colLetter = String.fromCharCode(65 + col);
    for (let row = minRow; row <= maxRow; row++) {
      cellIds.push(`${colLetter}${row}`);
    }
  }
  
  return { sheetId, cellIds };
}

export function evaluateConditionalFormat(
  format: ConditionalFormat,
  sheets: Record<string, Record<string, Cell>>,
  cellKey: string
): RuleEvaluationResult {
  const { sheetId, cellIds } = expandRangeRef(format.rangeRef);
  const targetSheet = sheets[sheetId];
  
  if (!targetSheet) {
    return { match: false, style: {} };
  }
  
  const cellIndex = cellIds.indexOf(cellKey.split(':')[1] || cellKey);
  if (cellIndex === -1) {
    return { match: false, style: {} };
  }
  
  const cell = targetSheet[cellIds[cellIndex]];
  if (!cell) {
    return { match: false, style: {} };
  }
  
  const ruleType = format.rule.type as ConditionalFormatRuleType;
  const params = format.rule.params || {};
  
  if (ruleType === 'dataBar') {
    const cells = cellIds.map(id => targetSheet[id]).filter(Boolean) as Cell[];
    const style = evaluateDataBar(cell, cells, params);
    return { match: true, style: { ...style, ...format.style } };
  }
  
  if (ruleType === 'colorScale2') {
    const cells = cellIds.map(id => targetSheet[id]).filter(Boolean) as Cell[];
    const style = evaluateColorScale2(cell, cells, params);
    return { match: true, style: { ...style, ...format.style } };
  }
  
  if (ruleType === 'colorScale3') {
    const cells = cellIds.map(id => targetSheet[id]).filter(Boolean) as Cell[];
    const style = evaluateColorScale3(cell, cells, params);
    return { match: true, style: { ...style, ...format.style } };
  }
  
  if (ruleType === 'duplicateValues') {
    const cells = cellIds.map(id => targetSheet[id]).filter(Boolean) as Cell[];
    const match = evaluateDuplicateValues(cells, cellIndex);
    return { match, style: match ? format.style : {} };
  }
  
  if (ruleType === 'topN') {
    const cells = cellIds.map(id => targetSheet[id]).filter(Boolean) as Cell[];
    const match = evaluateTopBottomN(cells, cellIndex, params.n as number || 10, true);
    return { match, style: match ? format.style : {} };
  }
  
  if (ruleType === 'bottomN') {
    const cells = cellIds.map(id => targetSheet[id]).filter(Boolean) as Cell[];
    const match = evaluateTopBottomN(cells, cellIndex, params.n as number || 10, false);
    return { match, style: match ? format.style : {} };
  }
  
  const match = evaluateComparisonRule(cell, ruleType, params);
  return { match, style: match ? format.style : {} };
}

export function mergeCellStyles(
  baseStyle: Partial<CellStyle> | undefined,
  conditionalResults: RuleEvaluationResult[]
): React.CSSProperties {
  const merged: React.CSSProperties = {};
  
  if (baseStyle) {
    if (baseStyle.fontColor) merged.color = baseStyle.fontColor;
    if (baseStyle.bgColor && !baseStyle.bgColor.startsWith('linear-gradient')) {
      merged.backgroundColor = baseStyle.bgColor;
    }
    if (baseStyle.bold) merged.fontWeight = 'bold';
    if (baseStyle.italic) merged.fontStyle = 'italic';
    if (baseStyle.align) merged.textAlign = baseStyle.align as 'left' | 'center' | 'right';
  }
  
  for (const result of conditionalResults) {
    if (result.match && result.style) {
      if (result.style.fontColor) merged.color = result.style.fontColor;
      if (result.style.bgColor) {
        if (result.style.bgColor.startsWith('linear-gradient')) {
          merged.background = result.style.bgColor;
        } else {
          merged.backgroundColor = result.style.bgColor;
        }
      }
      if (result.style.bold) merged.fontWeight = 'bold';
      if (result.style.italic) merged.fontStyle = 'italic';
      if (result.style.align) merged.textAlign = result.style.align as 'left' | 'center' | 'right';
    }
  }
  
  return merged;
}
