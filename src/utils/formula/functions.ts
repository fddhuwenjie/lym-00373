import type { Cell } from '../../../shared/types';

export type FunctionArgument = number | string | boolean | null | Cell[];

export interface FunctionDefinition {
  name: string;
  minArgs: number;
  maxArgs: number;
  execute: (args: FunctionArgument[], cells: Record<string, Cell>) => number | string | boolean | null | Cell[];
}

function flattenRange(args: FunctionArgument[]): (number | string | boolean | null)[] {
  const values: (number | string | boolean | null)[] = [];
  
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const cell of arg) {
        if (cell && !cell.isError && cell.value !== null && cell.value !== undefined) {
          values.push(cell.value as number | string | boolean);
        }
      }
    } else {
      values.push(arg);
    }
  }
  
  return values;
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
    execute: (args, cells) => {
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
