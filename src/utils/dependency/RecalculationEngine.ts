import { DependencyGraph } from './DependencyGraph';
import { parseFormula, evaluateFormula, parseCompoundKey, createCompoundKey } from '../formula';
import type { Cell, Sheet } from '../../../shared/types';

export interface RecalculationResult {
  updatedCells: Record<string, Record<string, Cell>>;
  circularCells: string[];
  recalculationTime: number;
  spillErrors: string[];
}

export interface SpillInfo {
  sourceKey: string;
  targetKeys: string[];
}

export class RecalculationEngine {
  private dependencyGraph: DependencyGraph;
  private sheets: Record<string, Record<string, Cell>>;
  private activeSheetId: string;
  private formulaCache: Map<string, { ast: any; dependencies: string[] }> = new Map();
  private spillMap: Map<string, SpillInfo> = new Map();

  constructor(sheets: Sheet[] = [], activeSheetId: string = 'sheet1') {
    this.dependencyGraph = new DependencyGraph();
    this.sheets = {};
    this.activeSheetId = activeSheetId;
    
    for (const sheet of sheets) {
      this.sheets[sheet.id] = { ...sheet.cells };
    }
    
    this.rebuildDependencyGraph();
  }

  setSheets(sheets: Sheet[], activeSheetId: string): void {
    this.sheets = {};
    this.activeSheetId = activeSheetId;
    
    for (const sheet of sheets) {
      this.sheets[sheet.id] = { ...sheet.cells };
    }
    
    this.rebuildDependencyGraph();
  }

  getSheets(): Record<string, Record<string, Cell>> {
    const result: Record<string, Record<string, Cell>> = {};
    for (const [sheetId, cells] of Object.entries(this.sheets)) {
      result[sheetId] = { ...cells };
    }
    return result;
  }

  getCells(sheetId?: string): Record<string, Cell> {
    const targetSheetId = sheetId || this.activeSheetId;
    return { ...(this.sheets[targetSheetId] || {}) };
  }

  getDependencyGraph(): DependencyGraph {
    return this.dependencyGraph;
  }

  getActiveSheetId(): string {
    return this.activeSheetId;
  }

  setActiveSheetId(sheetId: string): void {
    this.activeSheetId = sheetId;
  }

  private rebuildDependencyGraph(): void {
    this.dependencyGraph.clear();
    this.formulaCache.clear();
    this.spillMap.clear();

    for (const [sheetId, cells] of Object.entries(this.sheets)) {
      for (const [cellId, cell] of Object.entries(cells)) {
        if (cell.type === 'formula' && cell.formula && !cell.isSpillCell) {
          try {
            const compoundKey = createCompoundKey(sheetId, cellId);
            const { ast, dependencies } = parseFormula(cell.formula, sheetId);
            this.formulaCache.set(compoundKey, { ast, dependencies });
            this.dependencyGraph.updateDependencies(compoundKey, dependencies);
          } catch (error) {
            // Invalid formula, skip dependency tracking
          }
        }
      }
    }
  }

  private clearSpillRange(sourceKey: string): void {
    const spillInfo = this.spillMap.get(sourceKey);
    if (spillInfo) {
      for (const targetKey of spillInfo.targetKeys) {
        const { sheetId, cellId } = parseCompoundKey(targetKey);
        if (this.sheets[sheetId] && this.sheets[sheetId][cellId]) {
          const cell = this.sheets[sheetId][cellId];
          if (cell.isSpillCell && cell.spillSource === sourceKey) {
            delete this.sheets[sheetId][cellId];
          }
        }
      }
      this.spillMap.delete(sourceKey);
    }
  }

  private checkSpillConflict(sourceKey: string, targetKeys: string[]): boolean {
    for (const targetKey of targetKeys) {
      if (targetKey === sourceKey) continue;
      
      const { sheetId, cellId } = parseCompoundKey(targetKey);
      const cell = this.sheets[sheetId]?.[cellId];
      
      if (cell && !cell.isSpillCell && cell.rawValue !== '') {
        return true;
      }
      
      if (cell?.isSpillCell && cell.spillSource !== sourceKey) {
        return true;
      }
    }
    return false;
  }

  private applySpill(
    sourceKey: string,
    values: (number | string | boolean | null | Date)[],
    is2D: boolean = false,
    rowCount: number = 1,
    colCount: number = 1
  ): string[] {
    this.clearSpillRange(sourceKey);
    
    const { sheetId, cellId } = parseCompoundKey(sourceKey);
    const match = cellId.match(/([A-Z])(\d+)/);
    if (!match) return [];
    
    const startCol = match[1].charCodeAt(0) - 65;
    const startRow = parseInt(match[2], 10);
    
    const targetKeys: string[] = [];
    
    if (is2D) {
      for (let r = 0; r < rowCount; r++) {
        for (let c = 0; c < colCount; c++) {
          const idx = r * colCount + c;
          if (idx < values.length) {
            const colLetter = String.fromCharCode(65 + startCol + c);
            const rowNum = startRow + r;
            const targetCellId = `${colLetter}${rowNum}`;
            targetKeys.push(createCompoundKey(sheetId, targetCellId));
          }
        }
      }
    } else {
      for (let i = 0; i < values.length; i++) {
        const colLetter = String.fromCharCode(65 + startCol);
        const rowNum = startRow + i;
        const targetCellId = `${colLetter}${rowNum}`;
        targetKeys.push(createCompoundKey(sheetId, targetCellId));
      }
    }
    
    if (this.checkSpillConflict(sourceKey, targetKeys)) {
      return [];
    }
    
    for (let i = 0; i < targetKeys.length && i < values.length; i++) {
      const targetKey = targetKeys[i];
      const { sheetId: tSheetId, cellId: tCellId } = parseCompoundKey(targetKey);
      
      if (!this.sheets[tSheetId]) {
        this.sheets[tSheetId] = {};
      }
      
      const value = values[i];
      
      if (targetKey === sourceKey) {
        const cell = this.sheets[tSheetId][tCellId];
        if (cell) {
          cell.value = value;
          cell.isError = false;
          cell.errorMessage = undefined;
          cell.isSpillCell = false;
          cell.spillSource = undefined;
        }
      } else {
        this.sheets[tSheetId][tCellId] = {
          id: tCellId,
          type: value === null || value === undefined ? 'text' : 
                typeof value === 'number' ? 'number' :
                typeof value === 'boolean' ? 'text' :
                typeof value === 'object' && value instanceof Date ? 'date' : 'text',
          rawValue: '',
          value: value,
          isError: false,
          isCircular: false,
          isSpillCell: true,
          spillSource: sourceKey
        };
      }
    }
    
    this.spillMap.set(sourceKey, { sourceKey, targetKeys });
    return targetKeys;
  }

  updateCell(sheetId: string, cellId: string, rawValue: string): RecalculationResult {
    const startTime = performance.now();
    const compoundKey = createCompoundKey(sheetId, cellId);
    
    const oldCell = this.sheets[sheetId]?.[cellId];
    let oldDependencies: string[] = [];
    
    if (oldCell && oldCell.type === 'formula') {
      oldDependencies = this.dependencyGraph.getDependencies(compoundKey);
      this.clearSpillRange(compoundKey);
    }

    const newCell = this.parseCellValue(sheetId, cellId, rawValue);
    
    if (!this.sheets[sheetId]) {
      this.sheets[sheetId] = {};
    }
    this.sheets[sheetId][cellId] = newCell;

    let spillErrors: string[] = [];
    let spillTargetKeys: string[] = [];

    if (newCell.type === 'formula' && newCell.formula) {
      try {
        const { dependencies } = parseFormula(newCell.formula, sheetId);
        this.dependencyGraph.updateDependencies(compoundKey, dependencies);
        this.formulaCache.delete(compoundKey);
        
        const result = evaluateFormula(newCell.formula, this.sheets, sheetId);
        
        if (typeof result === 'string' && result.startsWith('#') && result.endsWith('!')) {
          newCell.isError = true;
          newCell.errorMessage = result;
          newCell.value = result;
        } else if (Array.isArray(result)) {
          const values = result.map(c => {
            if (c && 'value' in c) return c.value as number | string | boolean | null | Date;
            return c as unknown as number | string | boolean | null | Date;
          });
          
          spillTargetKeys = this.applySpill(compoundKey, values);
          if (spillTargetKeys.length === 0 && values.length > 0) {
            newCell.isError = true;
            newCell.errorMessage = '#SPILL!';
            newCell.value = '#SPILL!';
            spillErrors.push(compoundKey);
          }
        } else {
          newCell.isError = false;
          newCell.errorMessage = undefined;
          newCell.value = result;
        }
      } catch (error) {
        newCell.isError = true;
        newCell.errorMessage = '#ERROR!';
        newCell.value = '#ERROR!';
      }
    } else {
      const oldDeps = this.dependencyGraph.getDependencies(compoundKey);
      for (const dep of oldDeps) {
        this.dependencyGraph.removeEdge(dep, compoundKey);
      }
      this.formulaCache.delete(compoundKey);
    }

    const { order, cycles } = this.dependencyGraph.topologicalSort();
    
    const circularCells = new Set<string>();
    for (const cycle of cycles) {
      for (const cId of cycle) {
        circularCells.add(cId);
      }
    }

    for (const cKey of circularCells) {
      const { sheetId: sId, cellId: cId } = parseCompoundKey(cKey);
      if (this.sheets[sId]?.[cId]) {
        this.sheets[sId][cId].isCircular = true;
        this.sheets[sId][cId].isError = true;
        this.sheets[sId][cId].errorMessage = '#REF!';
        this.sheets[sId][cId].value = '#REF!';
      }
    }

    const affectedCells = new Set<string>([compoundKey, ...spillTargetKeys]);
    const allDependents = this.dependencyGraph.getAllDependents(compoundKey);
    for (const dep of allDependents) {
      affectedCells.add(dep);
    }

    const recalcOrder = order.filter(id => affectedCells.has(id) && !circularCells.has(id));

    for (const cKey of recalcOrder) {
      if (cKey === compoundKey) continue;
      
      const { sheetId: sId, cellId: cId } = parseCompoundKey(cKey);
      const cell = this.sheets[sId]?.[cId];
      if (!cell) continue;

      cell.isCircular = false;
      
      if (cell.isSpillCell) continue;
      
      if (cell.type === 'formula' && cell.formula) {
        try {
          this.clearSpillRange(cKey);
          
          const result = evaluateFormula(cell.formula, this.sheets, sId);
          
          if (typeof result === 'string' && result.startsWith('#') && result.endsWith('!')) {
            cell.isError = true;
            cell.errorMessage = result;
            cell.value = result;
          } else if (Array.isArray(result)) {
            const values = result.map(c => {
            if (c && 'value' in c) return c.value as number | string | boolean | null | Date;
            return c as unknown as number | string | boolean | null | Date;
          });
            
            const targets = this.applySpill(cKey, values);
            if (targets.length === 0 && values.length > 0) {
              cell.isError = true;
              cell.errorMessage = '#SPILL!';
              cell.value = '#SPILL!';
              spillErrors.push(cKey);
            } else {
              cell.isError = false;
              cell.errorMessage = undefined;
              for (const t of targets) {
                affectedCells.add(t);
              }
            }
          } else {
            cell.isError = false;
            cell.errorMessage = undefined;
            cell.value = result;
          }
        } catch (error) {
          cell.isError = true;
          cell.errorMessage = '#ERROR!';
          cell.value = '#ERROR!';
        }
      }
    }

    const endTime = performance.now();

    return {
      updatedCells: this.getSheets(),
      circularCells: Array.from(circularCells),
      recalculationTime: endTime - startTime,
      spillErrors
    };
  }

  private parseCellValue(sheetId: string, cellId: string, rawValue: string): Cell {
    const cell: Cell = {
      id: cellId,
      type: 'text',
      rawValue,
      value: rawValue,
      isError: false,
      isCircular: false,
      isSpillCell: false
    };

    if (rawValue.startsWith('=')) {
      cell.type = 'formula';
      cell.formula = rawValue;
      
      try {
        const result = evaluateFormula(rawValue, this.sheets, sheetId);
        if (typeof result === 'string' && result.startsWith('#') && result.endsWith('!')) {
          cell.isError = true;
          cell.errorMessage = result;
          cell.value = result;
        } else if (Array.isArray(result)) {
          cell.value = result.length > 0 ? result[0].value : null;
        } else {
          cell.value = result;
        }
      } catch (error) {
        cell.isError = true;
        cell.errorMessage = '#ERROR!';
        cell.value = '#ERROR!';
      }
      
      return cell;
    }

    const dateMatch = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateMatch) {
      const year = parseInt(dateMatch[1], 10);
      const month = parseInt(dateMatch[2], 10) - 1;
      const day = parseInt(dateMatch[3], 10);
      const date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        cell.type = 'date';
        cell.value = date;
        return cell;
      }
    }

    const numValue = parseFloat(rawValue);
    if (!isNaN(numValue) && rawValue.trim() !== '' && !isNaN(parseFloat(rawValue))) {
      cell.type = 'number';
      cell.value = numValue;
      return cell;
    }

    if (rawValue.toLowerCase() === 'true') {
      cell.type = 'text';
      cell.value = true;
      return cell;
    }
    if (rawValue.toLowerCase() === 'false') {
      cell.type = 'text';
      cell.value = false;
      return cell;
    }

    cell.type = 'text';
    cell.value = rawValue;
    return cell;
  }

  recalculateAll(): RecalculationResult {
    const startTime = performance.now();
    
    this.spillMap.clear();
    
    const { order, cycles } = this.dependencyGraph.topologicalSort();
    
    const circularCells = new Set<string>();
    for (const cycle of cycles) {
      for (const cellId of cycle) {
        circularCells.add(cellId);
      }
    }

    for (const cKey of circularCells) {
      const { sheetId: sId, cellId: cId } = parseCompoundKey(cKey);
      if (this.sheets[sId]?.[cId]) {
        this.sheets[sId][cId].isCircular = true;
        this.sheets[sId][cId].isError = true;
        this.sheets[sId][cId].errorMessage = '#REF!';
        this.sheets[sId][cId].value = '#REF!';
      }
    }

    const recalcOrder = order.filter(id => !circularCells.has(id));
    const spillErrors: string[] = [];
    
    for (const cKey of recalcOrder) {
      const { sheetId: sId, cellId: cId } = parseCompoundKey(cKey);
      const cell = this.sheets[sId]?.[cId];
      if (!cell) continue;

      cell.isCircular = false;
      
      if (cell.isSpillCell) continue;
      
      if (cell.type === 'formula' && cell.formula) {
        try {
          this.clearSpillRange(cKey);
          
          const result = evaluateFormula(cell.formula, this.sheets, sId);
          
          if (typeof result === 'string' && result.startsWith('#') && result.endsWith('!')) {
            cell.isError = true;
            cell.errorMessage = result;
            cell.value = result;
          } else if (Array.isArray(result)) {
            const values = result.map(c => {
            if (c && 'value' in c) return c.value as number | string | boolean | null | Date;
            return c as unknown as number | string | boolean | null | Date;
          });
            
            const targets = this.applySpill(cKey, values);
            if (targets.length === 0 && values.length > 0) {
              cell.isError = true;
              cell.errorMessage = '#SPILL!';
              cell.value = '#SPILL!';
              spillErrors.push(cKey);
            } else {
              cell.isError = false;
              cell.errorMessage = undefined;
            }
          } else {
            cell.isError = false;
            cell.errorMessage = undefined;
            cell.value = result;
          }
        } catch (error) {
          cell.isError = true;
          cell.errorMessage = '#ERROR!';
          cell.value = '#ERROR!';
        }
      }
    }

    const endTime = performance.now();

    return {
      updatedCells: this.getSheets(),
      circularCells: Array.from(circularCells),
      recalculationTime: endTime - startTime,
      spillErrors
    };
  }

  clearCache(): void {
    this.formulaCache.clear();
  }

  getSpillMap(): Map<string, SpillInfo> {
    return new Map(this.spillMap);
  }

  deleteSheet(sheetId: string): void {
    for (const [key, spillInfo] of this.spillMap) {
      if (key.startsWith(`${sheetId}:`)) {
        this.clearSpillRange(key);
      } else {
        for (const targetKey of spillInfo.targetKeys) {
          if (targetKey.startsWith(`${sheetId}:`)) {
            this.clearSpillRange(key);
            break;
          }
        }
      }
    }

    const dependentsToMark: string[] = [];
    for (const node of this.dependencyGraph.getNodes()) {
      if (!node.startsWith(`${sheetId}:`)) {
        const deps = this.dependencyGraph.getDependencies(node);
        for (const dep of deps) {
          if (dep.startsWith(`${sheetId}:`)) {
            dependentsToMark.push(node);
            break;
          }
        }
      }
    }

    for (const key of dependentsToMark) {
      const { sheetId: sId, cellId: cId } = parseCompoundKey(key);
      if (this.sheets[sId]?.[cId]) {
        this.sheets[sId][cId].isError = true;
        this.sheets[sId][cId].errorMessage = '#REF!';
        this.sheets[sId][cId].value = '#REF!';
      }
      this.dependencyGraph.removeNode(key);
    }

    for (const node of this.dependencyGraph.getNodes()) {
      if (node.startsWith(`${sheetId}:`)) {
        this.dependencyGraph.removeNode(node);
      }
    }

    delete this.sheets[sheetId];
  }

  renameSheet(oldSheetId: string, newSheetId: string): void {
    if (oldSheetId === newSheetId) return;
    
    this.sheets[newSheetId] = this.sheets[oldSheetId];
    delete this.sheets[oldSheetId];
    
    if (this.activeSheetId === oldSheetId) {
      this.activeSheetId = newSheetId;
    }
    
    this.rebuildDependencyGraph();
  }
}
