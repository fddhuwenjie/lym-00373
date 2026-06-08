import { create } from 'zustand';
import { RecalculationEngine } from '../utils/dependency';
import type { Cell, Workbook, WorkbookListItem, CellFormat } from '../../shared/types';

interface SpreadsheetState {
  cells: Record<string, Cell>;
  selectedCell: string | null;
  editingCell: string | null;
  formulaBarValue: string;
  workbookId: number | null;
  workbookName: string;
  workbooks: WorkbookListItem[];
  recalculationTime: number;
  circularCells: string[];
  engine: RecalculationEngine;

  setSelectedCell: (cellId: string | null) => void;
  setEditingCell: (cellId: string | null) => void;
  setFormulaBarValue: (value: string) => void;
  updateCell: (cellId: string, rawValue: string) => void;
  setCellFormat: (cellId: string, format: Partial<CellFormat>) => void;
  setWorkbookName: (name: string) => void;
  loadWorkbook: (workbook: Workbook) => void;
  newWorkbook: () => void;
  saveWorkbook: () => Promise<boolean>;
  loadWorkbookList: () => Promise<void>;
  loadWorkbookById: (id: number) => Promise<void>;
  deleteWorkbook: (id: number) => Promise<void>;
  exportCSV: () => void;
  recalculateAll: () => void;
}

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => ({
  cells: {},
  selectedCell: 'A1',
  editingCell: null,
  formulaBarValue: '',
  workbookId: null,
  workbookName: 'Untitled',
  workbooks: [],
  recalculationTime: 0,
  circularCells: [],
  engine: new RecalculationEngine(),

  setSelectedCell: (cellId: string | null) => {
    const state = get();
    set({
      selectedCell: cellId,
      formulaBarValue: cellId && state.cells[cellId] 
        ? state.cells[cellId].formula || state.cells[cellId].rawValue 
        : ''
    });
  },

  setEditingCell: (cellId: string | null) => set({ editingCell: cellId }),

  setFormulaBarValue: (value: string) => set({ formulaBarValue: value }),

  updateCell: (cellId: string, rawValue: string) => {
    const state = get();
    const result = state.engine.updateCell(cellId, rawValue);
    
    set({
      cells: state.engine.getCells(),
      recalculationTime: result.recalculationTime,
      circularCells: result.circularCells,
      formulaBarValue: rawValue
    });
  },

  setCellFormat: (cellId: string, format: Partial<CellFormat>) => {
    const state = get();
    const cell = state.cells[cellId];
    if (cell) {
      const updatedCell = {
        ...cell,
        format: { ...cell.format, ...format }
      };
      set({
        cells: { ...state.cells, [cellId]: updatedCell }
      });
    }
  },

  setWorkbookName: (name: string) => set({ workbookName: name }),

  loadWorkbook: (workbook: Workbook) => {
    const engine = new RecalculationEngine(workbook.cells);
    const result = engine.recalculateAll();
    
    set({
      cells: engine.getCells(),
      workbookId: workbook.id || null,
      workbookName: workbook.name,
      engine,
      recalculationTime: result.recalculationTime,
      circularCells: result.circularCells
    });
  },

  newWorkbook: () => {
    const engine = new RecalculationEngine();
    set({
      cells: {},
      selectedCell: 'A1',
      editingCell: null,
      formulaBarValue: '',
      workbookId: null,
      workbookName: 'Untitled',
      recalculationTime: 0,
      circularCells: [],
      engine
    });
  },

  saveWorkbook: async (): Promise<boolean> => {
    const state = get();
    const workbookData = {
      name: state.workbookName,
      cells: state.cells
    };

    try {
      let response;
      if (state.workbookId) {
        response = await fetch(`/api/workbooks/${state.workbookId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workbookData)
        });
      } else {
        response = await fetch('/api/workbooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(workbookData)
        });
      }

      if (response.ok) {
        const data = await response.json();
        set({ workbookId: data.data.id });
        await get().loadWorkbookList();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save workbook:', error);
      return false;
    }
  },

  loadWorkbookList: async (): Promise<void> => {
    try {
      const response = await fetch('/api/workbooks');
      if (response.ok) {
        const data = await response.json();
        set({ workbooks: data.data || [] });
      }
    } catch (error) {
      console.error('Failed to load workbook list:', error);
    }
  },

  loadWorkbookById: async (id: number): Promise<void> => {
    try {
      const response = await fetch(`/api/workbooks/${id}`);
      if (response.ok) {
        const data = await response.json();
        get().loadWorkbook(data.data);
      }
    } catch (error) {
      console.error('Failed to load workbook:', error);
    }
  },

  deleteWorkbook: async (id: number): Promise<void> => {
    try {
      const response = await fetch(`/api/workbooks/${id}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        await get().loadWorkbookList();
        if (get().workbookId === id) {
          get().newWorkbook();
        }
      }
    } catch (error) {
      console.error('Failed to delete workbook:', error);
    }
  },

  exportCSV: () => {
    const state = get();
    const maxRows = 100;
    const maxCols = 26;
    
    const rows: string[] = [];
    
    for (let row = 1; row <= maxRows; row++) {
      const rowData: string[] = [];
      for (let col = 0; col < maxCols; col++) {
        const colLetter = String.fromCharCode(65 + col);
        const cellId = `${colLetter}${row}`;
        const cell = state.cells[cellId];
        
        if (cell && !cell.isError && cell.value !== null && cell.value !== undefined) {
          let strValue = '';
          if (cell.value instanceof Date) {
            strValue = cell.value.toISOString().split('T')[0];
          } else {
            strValue = String(cell.value);
          }
          if (strValue.includes(',') || strValue.includes('"') || strValue.includes('\n')) {
            strValue = `"${strValue.replace(/"/g, '""')}"`;
          }
          rowData.push(strValue);
        } else {
          rowData.push('');
        }
      }
      const hasData = rowData.some(cell => cell !== '');
      if (hasData || row === 1) {
        rows.push(rowData.join(','));
      }
    }

    const csv = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${state.workbookName}.csv`;
    link.click();
  },

  recalculateAll: () => {
    const state = get();
    const result = state.engine.recalculateAll();
    set({
      cells: state.engine.getCells(),
      recalculationTime: result.recalculationTime,
      circularCells: result.circularCells
    });
  }
}));
