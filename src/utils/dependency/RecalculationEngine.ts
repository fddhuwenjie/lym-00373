import { DependencyGraph } from './DependencyGraph';
import { parseFormula, evaluateFormula } from '../formula';
import type { Cell } from '../../../shared/types';

export interface RecalculationResult {
  updatedCells: Record<string, Cell>;
  circularCells: string[];
  recalculationTime: number;
}

export class RecalculationEngine {
  private dependencyGraph: DependencyGraph;
  private cells: Record<string, Cell>;
  private formulaCache: Map<string, { ast: any; dependencies: string[] }> = new Map();

  constructor(cells: Record<string, Cell> = {}) {
    this.dependencyGraph = new DependencyGraph();
    this.cells = cells;
    this.rebuildDependencyGraph();
  }

  setCells(cells: Record<string, Cell>): void {
    this.cells = cells;
    this.rebuildDependencyGraph();
  }

  getCells(): Record<string, Cell> {
    return { ...this.cells };
  }

  getDependencyGraph(): DependencyGraph {
    return this.dependencyGraph;
  }

  private rebuildDependencyGraph(): void {
    this.dependencyGraph.clear();
    this.formulaCache.clear();

    for (const [cellId, cell] of Object.entries(this.cells)) {
      if (cell.type === 'formula' && cell.formula) {
        try {
          const { ast, dependencies } = parseFormula(cell.formula);
          this.formulaCache.set(cellId, { ast, dependencies });
          this.dependencyGraph.updateDependencies(cellId, dependencies);
        } catch (error) {
          // Invalid formula, skip dependency tracking
        }
      }
    }
  }

  updateCell(cellId: string, rawValue: string): RecalculationResult {
    const startTime = performance.now();
    
    const oldCell = this.cells[cellId];
    let oldDependencies: string[] = [];
    
    if (oldCell && oldCell.type === 'formula') {
      oldDependencies = this.dependencyGraph.getDependencies(cellId);
    }

    const newCell = this.parseCellValue(cellId, rawValue);
    this.cells[cellId] = newCell;

    if (newCell.type === 'formula' && newCell.formula) {
      try {
        const { dependencies } = parseFormula(newCell.formula);
        this.dependencyGraph.updateDependencies(cellId, dependencies);
        this.formulaCache.delete(cellId);
      } catch (error) {
        newCell.isError = true;
        newCell.errorMessage = '#ERROR!';
        newCell.value = '#ERROR!';
      }
    } else {
      const oldDeps = this.dependencyGraph.getDependencies(cellId);
      for (const dep of oldDeps) {
        this.dependencyGraph.removeEdge(dep, cellId);
      }
      this.formulaCache.delete(cellId);
    }

    const { order, cycles } = this.dependencyGraph.topologicalSort();
    
    const circularCells = new Set<string>();
    for (const cycle of cycles) {
      for (const cellId of cycle) {
        circularCells.add(cellId);
      }
    }

    for (const cId of circularCells) {
      if (this.cells[cId]) {
        this.cells[cId].isCircular = true;
        this.cells[cId].isError = true;
        this.cells[cId].errorMessage = '#REF!';
        this.cells[cId].value = '#REF!';
      }
    }

    const affectedCells = new Set<string>([cellId]);
    const allDependents = this.dependencyGraph.getAllDependents(cellId);
    for (const dep of allDependents) {
      affectedCells.add(dep);
    }

    const recalcOrder = order.filter(id => affectedCells.has(id) && !circularCells.has(id));

    for (const cId of recalcOrder) {
      const cell = this.cells[cId];
      if (!cell) continue;

      cell.isCircular = false;
      
      if (cell.type === 'formula' && cell.formula) {
        try {
          const result = evaluateFormula(cell.formula, this.cells);
          
          if (typeof result === 'string' && result.startsWith('#') && result.endsWith('!')) {
            cell.isError = true;
            cell.errorMessage = result;
            cell.value = result;
          } else if (Array.isArray(result)) {
            cell.isError = true;
            cell.errorMessage = '#VALUE!';
            cell.value = '#VALUE!';
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
    
    const updatedCells: Record<string, Cell> = {};
    for (const cId of affectedCells) {
      if (this.cells[cId]) {
        updatedCells[cId] = { ...this.cells[cId] };
      }
    }

    return {
      updatedCells,
      circularCells: Array.from(circularCells),
      recalculationTime: endTime - startTime
    };
  }

  private parseCellValue(cellId: string, rawValue: string): Cell {
    const cell: Cell = {
      id: cellId,
      type: 'text',
      rawValue,
      value: rawValue,
      isError: false,
      isCircular: false
    };

    if (rawValue.startsWith('=')) {
      cell.type = 'formula';
      cell.formula = rawValue;
      
      try {
        const result = evaluateFormula(rawValue, this.cells);
        if (typeof result === 'string' && result.startsWith('#') && result.endsWith('!')) {
          cell.isError = true;
          cell.errorMessage = result;
          cell.value = result;
        } else if (Array.isArray(result)) {
          cell.isError = true;
          cell.errorMessage = '#VALUE!';
          cell.value = '#VALUE!';
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
    
    const { order, cycles } = this.dependencyGraph.topologicalSort();
    
    const circularCells = new Set<string>();
    for (const cycle of cycles) {
      for (const cellId of cycle) {
        circularCells.add(cellId);
      }
    }

    for (const cId of circularCells) {
      if (this.cells[cId]) {
        this.cells[cId].isCircular = true;
        this.cells[cId].isError = true;
        this.cells[cId].errorMessage = '#REF!';
        this.cells[cId].value = '#REF!';
      }
    }

    const recalcOrder = order.filter(id => !circularCells.has(id));
    
    for (const cId of recalcOrder) {
      const cell = this.cells[cId];
      if (!cell) continue;

      cell.isCircular = false;
      
      if (cell.type === 'formula' && cell.formula) {
        try {
          const result = evaluateFormula(cell.formula, this.cells);
          
          if (typeof result === 'string' && result.startsWith('#') && result.endsWith('!')) {
            cell.isError = true;
            cell.errorMessage = result;
            cell.value = result;
          } else if (Array.isArray(result)) {
            cell.isError = true;
            cell.errorMessage = '#VALUE!';
            cell.value = '#VALUE!';
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
      updatedCells: { ...this.cells },
      circularCells: Array.from(circularCells),
      recalculationTime: endTime - startTime
    };
  }

  clearCache(): void {
    this.formulaCache.clear();
  }
}
