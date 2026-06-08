import type { Cell } from '../../../shared/types';

export type FunctionArgument = number | string | boolean | null | Cell[] | Date;

export interface FunctionDefinition {
  name: string;
  minArgs: number;
  maxArgs: number;
  execute: (args: FunctionArgument[], sheets: Record<string, Record<string, Cell>>, defaultSheetId: string) => number | string | boolean | null | Cell[] | Date;
}

function flattenRange(args: FunctionArgument[]): (number | string | boolean | null | Date)[] {
  const values: (number | string | boolean | null | Date)[] = [];
  
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const cell of arg) {
        if (cell && !cell.isError && cell.value !== null && cell.value !== undefined) {
          values.push(cell.value as number | string | boolean | Date);
        }
      }
    } else {
      values.push(arg);
    }
  }
  
  return values;
}

function flattenRangeWithCells(args: FunctionArgument[]): { value: number | string | boolean | null; cell: Cell }[] {
  const result: { value: number | string | boolean | null; cell: Cell }[] = [];
  
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const cell of arg) {
        if (cell) {
          result.push({
            value: cell.isError ? null : (cell.value as number | string | boolean | null),
            cell
          });
        }
      }
    }
  }
  
  return result;
}

function getNumericValues(args: FunctionArgument[]): number[] {
  const values = flattenRange(args);
  return values
    .filter(v => v !== null && v !== undefined && v !== '')
    .map(v => {
      if (typeof v === 'boolean') return v ? 1 : 0;
      if (typeof v === 'string') {
        const parsed = parseFloat(v);
        return isNaN(parsed) ? NaN : parsed;
      }
      return v as number;
    })
    .filter(v => !isNaN(v));
}

export const builtinFunctions: Record<string, FunctionDefinition> = {
  SUM: {
    name: 'SUM',
    minArgs: 1,
    maxArgs: 255,
    execute: (args) => {
      const values = getNumericValues(args);
      return values.reduce((sum, v) => sum + v, 0);
    }
  },
  
  AVERAGE: {
    name: 'AVERAGE',
    minArgs: 1,
    maxArgs: 255,
    execute: (args) => {
      const values = getNumericValues(args);
      if (values.length === 0) return '#DIV/0!';
      return values.reduce((sum, v) => sum + v, 0) / values.length;
    }
  },
  
  MIN: {
    name: 'MIN',
    minArgs: 1,
    maxArgs: 255,
    execute: (args) => {
      const values = getNumericValues(args);
      if (values.length === 0) return 0;
      return Math.min(...values);
    }
  },
  
  MAX: {
    name: 'MAX',
    minArgs: 1,
    maxArgs: 255,
    execute: (args) => {
      const values = getNumericValues(args);
      if (values.length === 0) return 0;
      return Math.max(...values);
    }
  },
  
  COUNT: {
    name: 'COUNT',
    minArgs: 1,
    maxArgs: 255,
    execute: (args) => {
      const values = getNumericValues(args);
      return values.length;
    }
  },
  
  IF: {
    name: 'IF',
    minArgs: 2,
    maxArgs: 3,
    execute: (args) => {
      const condition = args[0];
      const trueValue = args[1];
      const falseValue = args.length > 2 ? args[2] : false;
      
      let conditionResult: boolean;
      if (typeof condition === 'boolean') {
        conditionResult = condition;
      } else if (typeof condition === 'number') {
        conditionResult = condition !== 0;
      } else if (typeof condition === 'string') {
        conditionResult = condition.toLowerCase() === 'true';
      } else {
        conditionResult = false;
      }
      
      return conditionResult ? trueValue : falseValue;
    }
  },
  
  VLOOKUP: {
    name: 'VLOOKUP',
    minArgs: 3,
    maxArgs: 4,
    execute: (args) => {
      const lookupValue = args[0];
      const tableArray = args[1] as Cell[];
      const colIndexNum = args[2] as number;
      const rangeLookup = args.length > 3 ? args[3] !== false : true;
      
      if (!Array.isArray(tableArray)) {
        return '#VALUE!';
      }
      
      if (colIndexNum < 1) {
        return '#VALUE!';
      }
      
      let minCol = Infinity;
      let maxCol = -Infinity;
      let minRow = Infinity;
      let maxRow = -Infinity;
      
      for (const cell of tableArray) {
        if (!cell) continue;
        const match = cell.id.match(/([A-Z])(\d+)/);
        if (!match) continue;
        const col = match[1].charCodeAt(0) - 65;
        const row = parseInt(match[2], 10);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
      
      if (minCol === Infinity) {
        return '#N/A';
      }
      
      const numCols = maxCol - minCol + 1;
      const numRows = maxRow - minRow + 1;
      
      if (colIndexNum > numCols) {
        return '#REF!';
      }
      
      const table: (string | number | boolean | null)[][] = [];
      for (let r = 0; r < numRows; r++) {
        table.push(new Array(numCols).fill(null));
      }
      
      for (const cell of tableArray) {
        if (!cell) continue;
        const match = cell.id.match(/([A-Z])(\d+)/);
        if (!match) continue;
        const col = match[1].charCodeAt(0) - 65 - minCol;
        const row = parseInt(match[2], 10) - minRow;
        if (col >= 0 && col < numCols && row >= 0 && row < numRows) {
          let cellValue = cell.value;
          if (cellValue instanceof Date) {
            cellValue = cellValue.toISOString().split('T')[0];
          }
          table[row][col] = cellValue as string | number | boolean | null;
        }
      }
      
      const lookupCol = 0;
      const returnCol = colIndexNum - 1;
      
      if (rangeLookup) {
        let result: (string | number | boolean | null) = '#N/A';
        for (const row of table) {
          const cellValue = row[lookupCol];
          if (cellValue === null || cellValue === undefined) continue;
          if (compareValues(cellValue, lookupValue) <= 0) {
            result = row[returnCol] ?? '#N/A';
          } else {
            break;
          }
        }
        return result;
      } else {
        for (const row of table) {
          const cellValue = row[lookupCol];
          if (compareValues(cellValue, lookupValue) === 0) {
            return row[returnCol] ?? '#N/A';
          }
        }
        return '#N/A';
      }
    }
  },
  
  CONCAT: {
    name: 'CONCAT',
    minArgs: 1,
    maxArgs: 255,
    execute: (args) => {
      const values = flattenRange(args);
      return values.map(v => v === null || v === undefined ? '' : String(v)).join('');
    }
  },
  
  LEN: {
    name: 'LEN',
    minArgs: 1,
    maxArgs: 1,
    execute: (args) => {
      const value = args[0];
      if (value === null || value === undefined) return 0;
      return String(value).length;
    }
  },
  
  ROUND: {
    name: 'ROUND',
    minArgs: 1,
    maxArgs: 2,
    execute: (args) => {
      const number = args[0] as number;
      const decimals = (args.length > 1 ? args[1] : 0) as number;
      
      if (isNaN(number)) return '#VALUE!';
      
      const factor = Math.pow(10, decimals);
      return Math.round(number * factor) / factor;
    }
  },

  SUMIF: {
    name: 'SUMIF',
    minArgs: 2,
    maxArgs: 3,
    execute: (args) => {
      const range = args[0] as Cell[];
      const criteria = args[1];
      const sumRange = args.length > 2 ? args[2] as Cell[] : range;
      
      if (!Array.isArray(range) || !Array.isArray(sumRange)) {
        return '#VALUE!';
      }
      
      let sum = 0;
      for (let i = 0; i < range.length; i++) {
        const cell = range[i];
        const sumCell = sumRange[i];
        if (!cell || !sumCell || cell.isError || sumCell.isError) continue;
        
        if (matchCriteria(cell.value, criteria)) {
          const val = toNumber(sumCell.value);
          sum += val;
        }
      }
      
      return sum;
    }
  },

  COUNTIF: {
    name: 'COUNTIF',
    minArgs: 2,
    maxArgs: 2,
    execute: (args) => {
      const range = args[0] as Cell[];
      const criteria = args[1];
      
      if (!Array.isArray(range)) {
        return '#VALUE!';
      }
      
      let count = 0;
      for (const cell of range) {
        if (!cell || cell.isError) continue;
        if (matchCriteria(cell.value, criteria)) {
          count++;
        }
      }
      
      return count;
    }
  },

  SUMIFS: {
    name: 'SUMIFS',
    minArgs: 3,
    maxArgs: 255,
    execute: (args) => {
      const sumRange = args[0] as Cell[];
      
      if (!Array.isArray(sumRange)) {
        return '#VALUE!';
      }
      
      const criteriaPairs: { range: Cell[]; criteria: unknown }[] = [];
      for (let i = 1; i < args.length; i += 2) {
        if (i + 1 >= args.length) break;
        const range = args[i] as Cell[];
        const criteria = args[i + 1];
        if (!Array.isArray(range)) return '#VALUE!';
        criteriaPairs.push({ range, criteria });
      }
      
      let sum = 0;
      for (let i = 0; i < sumRange.length; i++) {
        const sumCell = sumRange[i];
        if (!sumCell || sumCell.isError) continue;
        
        let allMatch = true;
        for (const pair of criteriaPairs) {
          const cell = pair.range[i];
          if (!cell || cell.isError || !matchCriteria(cell.value, pair.criteria)) {
            allMatch = false;
            break;
          }
        }
        
        if (allMatch) {
          const val = toNumber(sumCell.value);
          sum += val;
        }
      }
      
      return sum;
    }
  },

  COUNTIFS: {
    name: 'COUNTIFS',
    minArgs: 2,
    maxArgs: 255,
    execute: (args) => {
      const criteriaPairs: { range: Cell[]; criteria: unknown }[] = [];
      for (let i = 0; i < args.length; i += 2) {
        if (i + 1 >= args.length) break;
        const range = args[i] as Cell[];
        const criteria = args[i + 1];
        if (!Array.isArray(range)) return '#VALUE!';
        criteriaPairs.push({ range, criteria });
      }
      
      if (criteriaPairs.length === 0) return '#VALUE!';
      
      let count = 0;
      const firstRange = criteriaPairs[0].range;
      
      for (let i = 0; i < firstRange.length; i++) {
        let allMatch = true;
        for (const pair of criteriaPairs) {
          const cell = pair.range[i];
          if (!cell || cell.isError || !matchCriteria(cell.value, pair.criteria)) {
            allMatch = false;
            break;
          }
        }
        if (allMatch) count++;
      }
      
      return count;
    }
  },

  INDEX: {
    name: 'INDEX',
    minArgs: 2,
    maxArgs: 3,
    execute: (args) => {
      const array = args[0] as Cell[];
      const rowNum = args[1] as number;
      const colNum = args.length > 2 ? args[2] as number : 1;
      
      if (!Array.isArray(array)) {
        return '#VALUE!';
      }
      
      let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
      for (const cell of array) {
        if (!cell) continue;
        const match = cell.id.match(/([A-Z])(\d+)/);
        if (!match) continue;
        const col = match[1].charCodeAt(0) - 65;
        const row = parseInt(match[2], 10);
        minCol = Math.min(minCol, col);
        maxCol = Math.max(maxCol, col);
        minRow = Math.min(minRow, row);
        maxRow = Math.max(maxRow, row);
      }
      
      if (minCol === Infinity) return '#REF!';
      
      const targetRow = minRow + rowNum - 1;
      const targetCol = minCol + colNum - 1;
      const targetCellId = `${String.fromCharCode(65 + targetCol)}${targetRow}`;
      
      const cell = array.find(c => c && c.id === targetCellId);
      if (!cell) return '#REF!';
      if (cell.isError) return cell.errorMessage || '#ERROR!';
      if (cell.value instanceof Date) return cell.value.toISOString().split('T')[0];
      return cell.value;
    }
  },

  MATCH: {
    name: 'MATCH',
    minArgs: 2,
    maxArgs: 3,
    execute: (args) => {
      const lookupValue = args[0];
      const lookupArray = args[1] as Cell[];
      const matchType = args.length > 2 ? args[2] as number : 1;
      
      if (!Array.isArray(lookupArray)) {
        return '#VALUE!';
      }
      
      const values = lookupArray.map(cell => cell ? (cell.isError ? null : cell.value) : null);
      
      if (matchType === 0) {
        for (let i = 0; i < values.length; i++) {
          if (compareValues(values[i], lookupValue) === 0) {
            return i + 1;
          }
        }
        return '#N/A';
      } else if (matchType === 1) {
        let result: number | string = '#N/A';
        for (let i = 0; i < values.length; i++) {
          if (values[i] === null || values[i] === undefined) continue;
          if (compareValues(values[i], lookupValue) <= 0) {
            result = i + 1;
          } else {
            break;
          }
        }
        return result;
      } else if (matchType === -1) {
        let result: number | string = '#N/A';
        for (let i = 0; i < values.length; i++) {
          if (values[i] === null || values[i] === undefined) continue;
          if (compareValues(values[i], lookupValue) >= 0) {
            result = i + 1;
          } else {
            break;
          }
        }
        return result;
      }
      
      return '#N/A';
    }
  },

  INDIRECT: {
    name: 'INDIRECT',
    minArgs: 1,
    maxArgs: 1,
    execute: (args, sheets, defaultSheetId) => {
      const refText = args[0];
      if (refText === null || refText === undefined) return '#REF!';
      
      const refStr = String(refText);
      let sheetId = defaultSheetId;
      let cellRef = refStr;
      
      const exclIndex = refStr.indexOf('!');
      if (exclIndex !== -1) {
        sheetId = refStr.substring(0, exclIndex).replace(/^'|'$/g, '');
        cellRef = refStr.substring(exclIndex + 1);
      }
      
      const sheetCells = sheets[sheetId];
      if (!sheetCells) return '#REF!';
      
      const cell = sheetCells[cellRef.toUpperCase()];
      if (!cell) return '#REF!';
      if (cell.isError) return cell.errorMessage || '#ERROR!';
      if (cell.value instanceof Date) return cell.value.toISOString().split('T')[0];
      return cell.value;
    }
  },

  TEXT: {
    name: 'TEXT',
    minArgs: 2,
    maxArgs: 2,
    execute: (args) => {
      const value = args[0];
      const format = args[1];
      
      if (value === null || value === undefined) return '';
      if (format === null || format === undefined) return String(value);
      
      const formatStr = String(format);
      const numValue = toNumber(value);
      
      if (formatStr === '0') {
        return String(Math.round(numValue));
      }
      if (formatStr === '0.00') {
        return numValue.toFixed(2);
      }
      if (formatStr === '#,##0') {
        return numValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
      }
      if (formatStr === '#,##0.00') {
        return numValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (formatStr === '0%') {
        return `${Math.round(numValue * 100)}%`;
      }
      if (formatStr === '0.00%') {
        return `${(numValue * 100).toFixed(2)}%`;
      }
      if (formatStr === 'yyyy-mm-dd' && value instanceof Date) {
        return value.toISOString().split('T')[0];
      }
      
      return String(value);
    }
  },

  DATE: {
    name: 'DATE',
    minArgs: 3,
    maxArgs: 3,
    execute: (args) => {
      const year = toNumber(args[0]);
      const month = toNumber(args[1]) - 1;
      const day = toNumber(args[2]);
      
      const date = new Date(year, month, day);
      if (isNaN(date.getTime())) return '#VALUE!';
      return date;
    }
  },

  NOW: {
    name: 'NOW',
    minArgs: 0,
    maxArgs: 0,
    execute: () => {
      return new Date();
    }
  },

  TODAY: {
    name: 'TODAY',
    minArgs: 0,
    maxArgs: 0,
    execute: () => {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    }
  },

  TRIM: {
    name: 'TRIM',
    minArgs: 1,
    maxArgs: 1,
    execute: (args) => {
      const value = args[0];
      if (value === null || value === undefined) return '';
      return String(value).trim().replace(/\s+/g, ' ');
    }
  },

  UPPER: {
    name: 'UPPER',
    minArgs: 1,
    maxArgs: 1,
    execute: (args) => {
      const value = args[0];
      if (value === null || value === undefined) return '';
      return String(value).toUpperCase();
    }
  },

  LOWER: {
    name: 'LOWER',
    minArgs: 1,
    maxArgs: 1,
    execute: (args) => {
      const value = args[0];
      if (value === null || value === undefined) return '';
      return String(value).toLowerCase();
    }
  }
};

function compareValues(a: unknown, b: unknown): number {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1;
  if (b === null || b === undefined) return 1;
  
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  
  const strA = String(a).toLowerCase();
  const strB = String(b).toLowerCase();
  
  if (strA < strB) return -1;
  if (strA > strB) return 1;
  return 0;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  
  if (typeof value === 'number') {
    return value;
  }
  
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? 0 : parsed;
  }
  
  return 0;
}

function matchCriteria(value: unknown, criteria: unknown): boolean {
  if (criteria === null || criteria === undefined) {
    return value === null || value === undefined;
  }
  
  if (typeof criteria === 'number') {
    return compareValues(value, criteria) === 0;
  }
  
  if (typeof criteria === 'boolean') {
    if (typeof value === 'boolean') return value === criteria;
    return toNumber(value) === (criteria ? 1 : 0);
  }
  
  if (typeof criteria === 'string') {
    const str = criteria;
    
    if (str.startsWith('>=')) {
      const num = parseFloat(str.slice(2));
      return !isNaN(num) && compareValues(value, num) >= 0;
    }
    if (str.startsWith('<=')) {
      const num = parseFloat(str.slice(2));
      return !isNaN(num) && compareValues(value, num) <= 0;
    }
    if (str.startsWith('<>')) {
      const rest = str.slice(2);
      const num = parseFloat(rest);
      if (!isNaN(num) && rest === String(num)) {
        return compareValues(value, num) !== 0;
      }
      return compareValues(value, rest) !== 0;
    }
    if (str.startsWith('>')) {
      const num = parseFloat(str.slice(1));
      return !isNaN(num) && compareValues(value, num) > 0;
    }
    if (str.startsWith('<')) {
      const num = parseFloat(str.slice(1));
      return !isNaN(num) && compareValues(value, num) < 0;
    }
    if (str.startsWith('=')) {
      const rest = str.slice(1);
      const num = parseFloat(rest);
      if (!isNaN(num) && rest === String(num)) {
        return compareValues(value, num) === 0;
      }
      return compareValues(value, rest) === 0;
    }
    
    if (str.includes('*') || str.includes('?')) {
      const pattern = str
        .replace(/\./g, '\\.')
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${pattern}$`, 'i');
      return regex.test(String(value ?? ''));
    }
    
    return compareValues(value, str) === 0;
  }
  
  return false;
}
