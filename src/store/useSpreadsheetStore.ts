import { create } from 'zustand';
import { RecalculationEngine } from '../utils/dependency';
import type { Cell, Workbook, WorkbookListItem, Sheet, CellStyle, ConditionalFormat, Chart, Operation, CollaboratorCursor } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

const MAX_STACK_SIZE = 100;

interface SpreadsheetState {
  sheets: Sheet[];
  activeSheetId: string;
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
  undoStack: Operation[];
  redoStack: Operation[];
  cellStyles: Record<string, CellStyle>;
  conditionalFormats: ConditionalFormat[];
  charts: Chart[];
  collaborators: Record<string, { name: string; color: string; sheetId: string; cellId: string; lastActive: number }>;
  wsConnected: boolean;
  version: number;
  history: Operation[];
  historyIndex: number;
  activePanel: 'sheets' | 'charts' | 'collaboration' | 'history' | null;
  userId: string;
  userName: string;
  userColor: string;
  lamportTime: number;
  ws: WebSocket | null;

  setSelectedCell: (cellId: string | null) => void;
  setEditingCell: (cellId: string | null) => void;
  setFormulaBarValue: (value: string) => void;
  updateCell: (cellId: string, rawValue: string) => void;
  setCellFormat: (cellId: string, format: Partial<CellStyle>) => void;
  setWorkbookName: (name: string) => void;
  loadWorkbook: (workbook: Workbook) => void;
  newWorkbook: () => void;
  saveWorkbook: () => Promise<boolean>;
  loadWorkbookList: () => Promise<void>;
  loadWorkbookById: (id: number) => Promise<void>;
  deleteWorkbook: (id: number) => Promise<void>;
  exportCSV: () => void;
  recalculateAll: () => void;

  setActiveSheet: (sheetId: string) => void;
  createSheet: (name?: string) => Promise<void>;
  renameSheet: (sheetId: string, name: string) => Promise<void>;
  deleteSheet: (sheetId: string) => Promise<void>;
  reorderSheet: (sheetId: string, newIndex: number) => Promise<void>;
  copySheet: (sheetId: string) => Promise<void>;
  updateCellWithUndo: (sheetId: string, cellId: string, rawValue: string) => void;
  updateCellStyleWithUndo: (sheetId: string, cellId: string, style: Partial<CellStyle>) => Promise<void>;
  undo: () => void;
  redo: () => void;
  connectWebSocket: (workbookId: number) => void;
  disconnectWebSocket: () => void;
  broadcastOperation: (operation: Operation) => void;
  loadWorkbookWithSheets: (workbook: Workbook) => Promise<void>;
  saveWorkbookWithSheets: () => Promise<boolean>;
  addConditionalFormat: (format: Omit<ConditionalFormat, 'id'>) => Promise<void>;
  deleteConditionalFormat: (id: string) => Promise<void>;
  updateConditionalFormat: (id: string, updates: Partial<ConditionalFormat>) => Promise<void>;
  addChart: (chart: Omit<Chart, 'id'>) => Promise<void>;
  deleteChart: (id: string) => Promise<void>;
  updateChart: (id: string, updates: Partial<Chart>) => Promise<void>;
  setActivePanel: (panel: 'sheets' | 'charts' | 'collaboration' | 'history' | null) => void;
  pushToUndoStack: (operation: Operation) => void;
  applyOperation: (operation: Operation) => void;
  reverseOperation: (operation: Operation) => void;
  toggleSheetVisibility: (sheetId: string) => void;
  setSheetTabColor: (sheetId: string, color: string) => void;
  jumpToVersion: (index: number) => void;
}

function generateUserId(): string {
  return localStorage.getItem('spreadsheet_user_id') || (() => {
    const id = uuidv4();
    localStorage.setItem('spreadsheet_user_id', id);
    return id;
  })();
}

function generateUserName(): string {
  return localStorage.getItem('spreadsheet_user_name') || (() => {
    const name = `User ${Math.floor(Math.random() * 1000)}`;
    localStorage.setItem('spreadsheet_user_name', name);
    return name;
  })();
}

function getUserColor(): string {
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#6366f1'];
  const stored = localStorage.getItem('spreadsheet_user_color');
  if (stored) return stored;
  const color = colors[Math.floor(Math.random() * colors.length)];
  localStorage.setItem('spreadsheet_user_color', color);
  return color;
}

function createDefaultSheet(index: number): Sheet {
  return {
    id: `sheet${index + 1}`,
    name: `Sheet${index + 1}`,
    index,
    cells: {},
    isHidden: false
  };
}

function createDefaultSheets(): Sheet[] {
  return [createDefaultSheet(0)];
}

function getCellStyleKey(sheetId: string, cellId: string): string {
  return `${sheetId}:${cellId}`;
}

export const useSpreadsheetStore = create<SpreadsheetState>((set, get) => {
  const userId = generateUserId();
  const userName = generateUserName();
  const userColor = getUserColor();

  let ws: WebSocket | null = null;
  let lamportTime = 0;

  function incrementLamportTime(): number {
    lamportTime += 1;
    return lamportTime;
  }

  function updateLamportTime(received: number): void {
    lamportTime = Math.max(lamportTime, received) + 1;
  }

  function createOperation(
    type: Operation['type'],
    sheetId: string,
    payload: Record<string, unknown>,
    reversePayload?: Record<string, unknown>
  ): Operation {
    return {
      id: uuidv4(),
      type,
      timestamp: Date.now(),
      lamportTime: incrementLamportTime(),
      userId,
      userName,
      sheetId,
      payload,
      reversePayload
    };
  }

  function setupKeyboardShortcuts(): void {
    if (typeof window === 'undefined') return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        get().undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        get().redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
  }

  setupKeyboardShortcuts();

  const defaultSheets = createDefaultSheets();
  const defaultEngine = new RecalculationEngine(defaultSheets, 'sheet1');

  return {
    sheets: defaultSheets,
    activeSheetId: 'sheet1',
    cells: defaultEngine.getCells('sheet1'),
    selectedCell: 'A1',
    editingCell: null,
    formulaBarValue: '',
    workbookId: null,
    workbookName: 'Untitled',
    workbooks: [],
    recalculationTime: 0,
    circularCells: [],
    engine: defaultEngine,
    undoStack: [],
    redoStack: [],
    cellStyles: {},
    conditionalFormats: [],
    charts: [],
    collaborators: {},
    wsConnected: false,
    version: 0,
    history: [],
    historyIndex: -1,
    activePanel: null,
    userId,
    userName,
    userColor,
    lamportTime: 0,
    ws: null,

    setSelectedCell: (cellId: string | null) => {
      const state = get();
      const activeSheet = state.sheets.find(s => s.id === state.activeSheetId);
      const cell = cellId && activeSheet ? activeSheet.cells[cellId] : null;
      
      set({
        selectedCell: cellId,
        formulaBarValue: cell ? (cell.formula || cell.rawValue) : ''
      });

      if (cellId && state.ws && state.wsConnected && state.workbookId) {
        state.ws.send(JSON.stringify({
          type: 'cursor',
          payload: {
            sheetId: state.activeSheetId,
            cellId
          }
        }));
      }
    },

    setEditingCell: (cellId: string | null) => set({ editingCell: cellId }),

    setFormulaBarValue: (value: string) => set({ formulaBarValue: value }),

    updateCell: (cellId: string, rawValue: string) => {
      const state = get();
      state.updateCellWithUndo(state.activeSheetId, cellId, rawValue);
    },

    setCellFormat: (cellId: string, format: Partial<CellStyle>) => {
      const state = get();
      state.updateCellStyleWithUndo(state.activeSheetId, cellId, format);
    },

    setWorkbookName: (name: string) => set({ workbookName: name }),

    loadWorkbook: (workbook: Workbook) => {
      get().loadWorkbookWithSheets(workbook);
    },

    newWorkbook: () => {
      const defaultSheets = createDefaultSheets();
      const engine = new RecalculationEngine(defaultSheets, defaultSheets[0].id);
      set({
        sheets: defaultSheets,
        activeSheetId: defaultSheets[0].id,
        cells: engine.getCells(defaultSheets[0].id),
        selectedCell: 'A1',
        editingCell: null,
        formulaBarValue: '',
        workbookId: null,
        workbookName: 'Untitled',
        recalculationTime: 0,
        circularCells: [],
        engine,
        undoStack: [],
        redoStack: [],
        cellStyles: {},
        conditionalFormats: [],
        charts: [],
        collaborators: {},
        version: 0,
        history: [],
        historyIndex: -1
      });
      get().disconnectWebSocket();
    },

    saveWorkbook: async (): Promise<boolean> => {
      return get().saveWorkbookWithSheets();
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
          await get().loadWorkbookWithSheets(data.data);
          get().connectWebSocket(id);
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
      const activeSheet = state.sheets.find(s => s.id === state.activeSheetId);
      if (!activeSheet) return;

      const maxRows = 100;
      const maxCols = 26;
      
      const rows: string[] = [];
      
      for (let row = 1; row <= maxRows; row++) {
        const rowData: string[] = [];
        for (let col = 0; col < maxCols; col++) {
          const colLetter = String.fromCharCode(65 + col);
          const cellId = `${colLetter}${row}`;
          const cell = activeSheet.cells[cellId];
          
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
      link.download = `${state.workbookName}_${activeSheet.name}.csv`;
      link.click();
    },

    recalculateAll: () => {
      const state = get();
      const result = state.engine.recalculateAll();
      const updatedSheets = state.sheets.map(sheet => ({
        ...sheet,
        cells: state.engine.getCells(sheet.id)
      }));
      
      set({
        sheets: updatedSheets,
        cells: state.engine.getCells(state.activeSheetId),
        recalculationTime: result.recalculationTime,
        circularCells: result.circularCells
      });
    },

    setActiveSheet: (sheetId: string) => {
      const state = get();
      const sheet = state.sheets.find(s => s.id === sheetId);
      if (!sheet) return;

      state.engine.setActiveSheetId(sheetId);
      
      set({
        activeSheetId: sheetId,
        cells: state.engine.getCells(sheetId),
        selectedCell: 'A1',
        formulaBarValue: ''
      });

      if (state.ws && state.wsConnected) {
        state.ws.send(JSON.stringify({
          type: 'cursor',
          payload: {
            sheetId,
            cellId: 'A1'
          }
        }));
      }
    },

    createSheet: async (name?: string): Promise<void> => {
      const state = get();
      if (!state.workbookId) return;

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/sheets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });

        if (response.ok) {
          const data = await response.json();
          const newSheet: Sheet = data.data;
          
          const oldSheets = [...state.sheets];
          const newSheets = [...state.sheets, newSheet];
          
          const operation = createOperation('sheetCreate', newSheet.id, 
            { sheet: newSheet },
            { sheetId: newSheet.id }
          );

          state.engine.setSheets(newSheets, state.activeSheetId);
          
          set({
            sheets: newSheets,
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to create sheet:', error);
      }
    },

    renameSheet: async (sheetId: string, name: string): Promise<void> => {
      const state = get();
      if (!state.workbookId) return;

      const sheet = state.sheets.find(s => s.id === sheetId);
      if (!sheet) return;

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/sheets/${sheetId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });

        if (response.ok) {
          const oldSheets = [...state.sheets];
          const newSheets = state.sheets.map(s => 
            s.id === sheetId ? { ...s, name } : s
          );

          const operation = createOperation('sheetRename', sheetId,
            { sheetId, name },
            { sheetId, name: sheet.name }
          );

          state.engine.setSheets(newSheets, state.activeSheetId);
          
          set({
            sheets: newSheets,
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to rename sheet:', error);
      }
    },

    deleteSheet: async (sheetId: string): Promise<void> => {
      const state = get();
      if (!state.workbookId || state.sheets.length <= 1) return;

      const sheet = state.sheets.find(s => s.id === sheetId);
      if (!sheet) return;

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/sheets/${sheetId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const oldSheets = [...state.sheets];
          const newSheets = state.sheets.filter(s => s.id !== sheetId);
          const newActiveSheetId = state.activeSheetId === sheetId ? newSheets[0].id : state.activeSheetId;

          const operation = createOperation('sheetDelete', sheetId,
            { sheetId },
            { sheet, oldActiveSheetId: state.activeSheetId }
          );

          state.engine.deleteSheet(sheetId);
          state.engine.setSheets(newSheets, newActiveSheetId);
          
          const newCellStyles = { ...state.cellStyles };
          Object.keys(newCellStyles).forEach(key => {
            if (key.startsWith(`${sheetId}:`)) {
              delete newCellStyles[key];
            }
          });

          const newConditionalFormats = state.conditionalFormats.filter(f => f.sheetId !== sheetId);
          const newCharts = state.charts.filter(c => c.sheetId !== sheetId);

          set({
            sheets: newSheets,
            activeSheetId: newActiveSheetId,
            cellStyles: newCellStyles,
            conditionalFormats: newConditionalFormats,
            charts: newCharts,
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to delete sheet:', error);
      }
    },

    reorderSheet: async (sheetId: string, newIndex: number): Promise<void> => {
      const state = get();
      if (!state.workbookId) return;

      const sheet = state.sheets.find(s => s.id === sheetId);
      if (!sheet) return;

      const oldIndex = state.sheets.findIndex(s => s.id === sheetId);
      if (oldIndex === newIndex) return;

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/sheets/${sheetId}/reorder`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newIndex })
        });

        if (response.ok) {
          const oldSheets = [...state.sheets];
          let newSheets = state.sheets.filter(s => s.id !== sheetId);
          const updatedSheet = { ...sheet, index: newIndex };
          newSheets.splice(newIndex, 0, updatedSheet);
          newSheets = newSheets.map((s, i) => ({ ...s, index: i }));

          const operation = createOperation('sheetReorder', sheetId,
            { sheetId, newIndex },
            { sheetId, oldIndex }
          );

          state.engine.setSheets(newSheets, state.activeSheetId);
          
          set({
            sheets: newSheets,
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to reorder sheet:', error);
      }
    },

    copySheet: async (sheetId: string): Promise<void> => {
      const state = get();
      if (!state.workbookId) return;

      const sheet = state.sheets.find(s => s.id === sheetId);
      if (!sheet) return;

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/sheets/${sheetId}/copy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
          const data = await response.json();
          const newSheet: Sheet = data.data;
          
          const oldSheets = [...state.sheets];
          const newSheets = [...state.sheets, newSheet];
          
          const operation = createOperation('sheetCopy', newSheet.id,
            { sourceSheetId: sheetId, newSheet },
            { sheetId: newSheet.id }
          );

          state.engine.setSheets(newSheets, state.activeSheetId);
          
          set({
            sheets: newSheets,
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to copy sheet:', error);
      }
    },

    updateCellWithUndo: (sheetId: string, cellId: string, rawValue: string) => {
      const state = get();
      const sheet = state.sheets.find(s => s.id === sheetId);
      if (!sheet) return;

      const oldCell = sheet.cells[cellId];
      const oldRawValue = oldCell ? oldCell.rawValue : '';

      if (oldRawValue === rawValue) return;

      const result = state.engine.updateCell(sheetId, cellId, rawValue);
      const updatedSheets = state.sheets.map(s => ({
        ...s,
        cells: s.id === sheetId ? result.updatedCells[sheetId] || sheet.cells : s.cells
      }));

      const operation = createOperation('cellUpdate', sheetId,
        { sheetId, cellId, rawValue },
        { sheetId, cellId, rawValue: oldRawValue }
      );

      set({
        sheets: updatedSheets,
        cells: result.updatedCells[sheetId] || state.cells,
        recalculationTime: result.recalculationTime,
        circularCells: result.circularCells,
        formulaBarValue: rawValue,
        history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
      });

      state.pushToUndoStack(operation);
      state.broadcastOperation(operation);
    },

    updateCellStyleWithUndo: async (sheetId: string, cellId: string, style: Partial<CellStyle>): Promise<void> => {
      const state = get();
      if (!state.workbookId) return;

      const key = getCellStyleKey(sheetId, cellId);
      const oldStyle = state.cellStyles[key];

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/styles/${sheetId}/${cellId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(style)
        });

        if (response.ok) {
          const data = await response.json();
          const newStyle: CellStyle = data.data;
          const newCellStyles = {
            ...state.cellStyles,
            [key]: newStyle
          };

          const operation = createOperation('cellFormatUpdate', sheetId,
            { sheetId, cellId, style: newStyle },
            { sheetId, cellId, style: oldStyle }
          );

          set({
            cellStyles: newCellStyles,
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to update cell style:', error);
      }
    },

    pushToUndoStack: (operation: Operation) => {
      const state = get();
      const newUndoStack = [operation, ...state.undoStack].slice(0, MAX_STACK_SIZE);
      set({
        undoStack: newUndoStack,
        redoStack: []
      });
    },

    undo: () => {
      const state = get();
      if (state.undoStack.length === 0) return;

      const operation = state.undoStack[0];
      const newUndoStack = state.undoStack.slice(1);

      state.reverseOperation(operation);

      set({
        undoStack: newUndoStack,
        redoStack: [operation, ...state.redoStack].slice(0, MAX_STACK_SIZE)
      });
    },

    redo: () => {
      const state = get();
      if (state.redoStack.length === 0) return;

      const operation = state.redoStack[0];
      const newRedoStack = state.redoStack.slice(1);

      state.applyOperation(operation);

      set({
        redoStack: newRedoStack,
        undoStack: [operation, ...state.undoStack].slice(0, MAX_STACK_SIZE)
      });
    },

    applyOperation: (operation: Operation) => {
      const state = get();
      updateLamportTime(operation.lamportTime);

      switch (operation.type) {
        case 'cellUpdate': {
          const { sheetId, cellId, rawValue } = operation.payload as { sheetId: string; cellId: string; rawValue: string };
          const result = state.engine.updateCell(sheetId, cellId, rawValue);
          const updatedSheets = state.sheets.map(s => ({
            ...s,
            cells: s.id === sheetId ? result.updatedCells[sheetId] || s.cells : s.cells
          }));
          set({
            sheets: updatedSheets,
            cells: sheetId === state.activeSheetId ? (result.updatedCells[sheetId] || state.cells) : state.cells,
            recalculationTime: result.recalculationTime,
            circularCells: result.circularCells
          });
          break;
        }
        case 'cellFormatUpdate': {
          const { sheetId, cellId, style } = operation.payload as { sheetId: string; cellId: string; style: CellStyle };
          const key = getCellStyleKey(sheetId, cellId);
          set({
            cellStyles: {
              ...state.cellStyles,
              [key]: style
            }
          });
          break;
        }
        case 'sheetCreate': {
          const { sheet } = operation.payload as { sheet: Sheet };
          const newSheets = [...state.sheets, sheet];
          state.engine.setSheets(newSheets, state.activeSheetId);
          set({ sheets: newSheets });
          break;
        }
        case 'sheetRename': {
          const { sheetId, name } = operation.payload as { sheetId: string; name: string };
          const newSheets = state.sheets.map(s => 
            s.id === sheetId ? { ...s, name } : s
          );
          state.engine.setSheets(newSheets, state.activeSheetId);
          set({ sheets: newSheets });
          break;
        }
        case 'sheetDelete': {
          const { sheetId } = operation.payload as { sheetId: string };
          const newSheets = state.sheets.filter(s => s.id !== sheetId);
          const newActiveSheetId = state.activeSheetId === sheetId ? newSheets[0]?.id || '' : state.activeSheetId;
          state.engine.deleteSheet(sheetId);
          state.engine.setSheets(newSheets, newActiveSheetId);
          
          const newCellStyles = { ...state.cellStyles };
          Object.keys(newCellStyles).forEach(key => {
            if (key.startsWith(`${sheetId}:`)) delete newCellStyles[key];
          });
          
          set({
            sheets: newSheets,
            activeSheetId: newActiveSheetId,
            cells: state.engine.getCells(newActiveSheetId),
            cellStyles: newCellStyles,
            conditionalFormats: state.conditionalFormats.filter(f => f.sheetId !== sheetId),
            charts: state.charts.filter(c => c.sheetId !== sheetId)
          });
          break;
        }
        case 'sheetReorder': {
          const { sheetId, newIndex } = operation.payload as { sheetId: string; newIndex: number };
          const sheet = state.sheets.find(s => s.id === sheetId);
          if (!sheet) break;
          
          let newSheets = state.sheets.filter(s => s.id !== sheetId);
          const updatedSheet = { ...sheet, index: newIndex };
          newSheets.splice(newIndex, 0, updatedSheet);
          newSheets = newSheets.map((s, i) => ({ ...s, index: i }));
          
          state.engine.setSheets(newSheets, state.activeSheetId);
          set({ sheets: newSheets });
          break;
        }
        case 'sheetCopy': {
          const { newSheet } = operation.payload as { newSheet: Sheet };
          const newSheets = [...state.sheets, newSheet];
          state.engine.setSheets(newSheets, state.activeSheetId);
          set({ sheets: newSheets });
          break;
        }
        case 'conditionalFormatAdd': {
          const { format } = operation.payload as { format: ConditionalFormat };
          set({ conditionalFormats: [...state.conditionalFormats, format] });
          break;
        }
        case 'conditionalFormatRemove': {
          const { id } = operation.payload as { id: string };
          set({ conditionalFormats: state.conditionalFormats.filter(f => f.id !== id) });
          break;
        }
        case 'conditionalFormatUpdate': {
          const { format } = operation.payload as { format: ConditionalFormat };
          set({ 
            conditionalFormats: state.conditionalFormats.map(f => 
              f.id === format.id ? format : f
            )
          });
          break;
        }
        case 'chartAdd': {
          const { chart } = operation.payload as { chart: Chart };
          set({ charts: [...state.charts, chart] });
          break;
        }
        case 'chartRemove': {
          const { id } = operation.payload as { id: string };
          set({ charts: state.charts.filter(c => c.id !== id) });
          break;
        }
      }
    },

    reverseOperation: (operation: Operation) => {
      const state = get();
      if (!operation.reversePayload) return;

      switch (operation.type) {
        case 'cellUpdate': {
          const { sheetId, cellId, rawValue } = operation.reversePayload as { sheetId: string; cellId: string; rawValue: string };
          const result = state.engine.updateCell(sheetId, cellId, rawValue);
          const updatedSheets = state.sheets.map(s => ({
            ...s,
            cells: s.id === sheetId ? result.updatedCells[sheetId] || s.cells : s.cells
          }));
          set({
            sheets: updatedSheets,
            cells: sheetId === state.activeSheetId ? (result.updatedCells[sheetId] || state.cells) : state.cells,
            recalculationTime: result.recalculationTime,
            circularCells: result.circularCells,
            formulaBarValue: state.selectedCell && sheetId === state.activeSheetId ? rawValue : state.formulaBarValue
          });
          break;
        }
        case 'cellFormatUpdate': {
          const { sheetId, cellId, style } = operation.reversePayload as { sheetId: string; cellId: string; style: CellStyle | undefined };
          const key = getCellStyleKey(sheetId, cellId);
          const newCellStyles = { ...state.cellStyles };
          if (style) {
            newCellStyles[key] = style;
          } else {
            delete newCellStyles[key];
          }
          set({ cellStyles: newCellStyles });
          break;
        }
        case 'sheetCreate': {
          const { sheetId } = operation.reversePayload as { sheetId: string };
          const newSheets = state.sheets.filter(s => s.id !== sheetId);
          const newActiveSheetId = state.activeSheetId === sheetId ? newSheets[0]?.id || '' : state.activeSheetId;
          state.engine.deleteSheet(sheetId);
          state.engine.setSheets(newSheets, newActiveSheetId);
          set({ sheets: newSheets, activeSheetId: newActiveSheetId });
          break;
        }
        case 'sheetRename': {
          const { sheetId, name } = operation.reversePayload as { sheetId: string; name: string };
          const newSheets = state.sheets.map(s => 
            s.id === sheetId ? { ...s, name } : s
          );
          state.engine.setSheets(newSheets, state.activeSheetId);
          set({ sheets: newSheets });
          break;
        }
        case 'sheetDelete': {
          const { sheet, oldActiveSheetId } = operation.reversePayload as { sheet: Sheet; oldActiveSheetId: string };
          const newSheets = [...state.sheets, sheet];
          state.engine.setSheets(newSheets, oldActiveSheetId);
          set({ 
            sheets: newSheets, 
            activeSheetId: oldActiveSheetId,
            cells: state.engine.getCells(oldActiveSheetId)
          });
          break;
        }
        case 'sheetReorder': {
          const { sheetId, oldIndex } = operation.reversePayload as { sheetId: string; oldIndex: number };
          const sheet = state.sheets.find(s => s.id === sheetId);
          if (!sheet) break;
          
          let newSheets = state.sheets.filter(s => s.id !== sheetId);
          const updatedSheet = { ...sheet, index: oldIndex };
          newSheets.splice(oldIndex, 0, updatedSheet);
          newSheets = newSheets.map((s, i) => ({ ...s, index: i }));
          
          state.engine.setSheets(newSheets, state.activeSheetId);
          set({ sheets: newSheets });
          break;
        }
        case 'sheetCopy': {
          const { sheetId } = operation.reversePayload as { sheetId: string };
          const newSheets = state.sheets.filter(s => s.id !== sheetId);
          state.engine.deleteSheet(sheetId);
          state.engine.setSheets(newSheets, state.activeSheetId);
          set({ sheets: newSheets });
          break;
        }
        case 'conditionalFormatAdd': {
          const { id } = operation.reversePayload as { id: string };
          set({ conditionalFormats: state.conditionalFormats.filter(f => f.id !== id) });
          break;
        }
        case 'conditionalFormatRemove': {
          const { format } = operation.reversePayload as { format: ConditionalFormat };
          set({ conditionalFormats: [...state.conditionalFormats, format] });
          break;
        }
        case 'conditionalFormatUpdate': {
          const { format } = operation.reversePayload as { format: ConditionalFormat };
          set({ 
            conditionalFormats: state.conditionalFormats.map(f => 
              f.id === format.id ? format : f
            )
          });
          break;
        }
        case 'chartAdd': {
          const { id } = operation.reversePayload as { id: string };
          set({ charts: state.charts.filter(c => c.id !== id) });
          break;
        }
        case 'chartRemove': {
          const { chart } = operation.reversePayload as { chart: Chart };
          set({ charts: [...state.charts, chart] });
          break;
        }
      }
    },

    connectWebSocket: (workbookId: number) => {
      const state = get();
      state.disconnectWebSocket();

      if (typeof window === 'undefined') return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/workbooks/${workbookId}`;
      
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          set({ wsConnected: true, ws });
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            updateLamportTime(message.payload?.lamportTime || 0);

            switch (message.type) {
              case 'welcome': {
                const { userId: newUserId, userName: newUserName, color, collaborators } = message.payload;
                if (newUserId && newUserName && color) {
                  localStorage.setItem('spreadsheet_user_id', newUserId);
                  localStorage.setItem('spreadsheet_user_name', newUserName);
                  localStorage.setItem('spreadsheet_user_color', color);
                  set({ userId: newUserId, userName: newUserName, userColor: color });
                }
                if (collaborators) {
                  const collabMap: Record<string, { name: string; color: string; sheetId: string; cellId: string; lastActive: number }> = {};
                  collaborators.forEach((c: CollaboratorCursor) => {
                    collabMap[c.userId] = {
                      name: c.userName,
                      color: c.color,
                      sheetId: c.sheetId,
                      cellId: c.cellId,
                      lastActive: c.lastActive
                    };
                  });
                  set({ collaborators: collabMap });
                }
                break;
              }
              case 'hello': {
                const { userId: collabId, userName: collabName, color, disconnected } = message.payload;
                if (disconnected) {
                  const newCollaborators = { ...state.collaborators };
                  delete newCollaborators[collabId];
                  set({ collaborators: newCollaborators });
                } else {
                  set({
                    collaborators: {
                      ...state.collaborators,
                      [collabId]: {
                        name: collabName,
                        color,
                        sheetId: '',
                        cellId: '',
                        lastActive: Date.now()
                      }
                    }
                  });
                }
                break;
              }
              case 'cursor': {
                const cursor = message.payload as CollaboratorCursor;
                set({
                  collaborators: {
                    ...state.collaborators,
                    [cursor.userId]: {
                      name: cursor.userName,
                      color: cursor.color,
                      sheetId: cursor.sheetId,
                      cellId: cursor.cellId,
                      lastActive: cursor.lastActive
                    }
                  }
                });
                break;
              }
              case 'operation': {
                const operation = message.payload as Operation;
                if (operation.userId !== state.userId) {
                  state.applyOperation(operation);
                  set({
                    history: [operation, ...state.history].slice(0, MAX_STACK_SIZE),
                    version: (message.payload as any).version || state.version
                  });
                }
                break;
              }
              case 'sync': {
                const { version: newVersion, operations } = message.payload;
                operations.forEach((op: Operation) => {
                  if (op.userId !== state.userId) {
                    state.applyOperation(op);
                  }
                });
                set({ version: newVersion });
                break;
              }
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          set({ wsConnected: false, ws: null });
          ws = null;
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          set({ wsConnected: false, ws: null });
          ws = null;
        };
      } catch (error) {
        console.error('Failed to connect WebSocket:', error);
      }
    },

    disconnectWebSocket: () => {
      if (ws) {
        try {
          ws.close();
        } catch (e) {
          // ignore
        }
        ws = null;
      }
      set({ wsConnected: false, ws: null, collaborators: {} });
    },

    broadcastOperation: (operation: Operation) => {
      const state = get();
      if (state.ws && state.wsConnected && operation.userId === state.userId) {
        try {
          state.ws.send(JSON.stringify({
            type: 'operation',
            payload: operation
          }));
        } catch (error) {
          console.error('Failed to broadcast operation:', error);
        }
      }
    },

    loadWorkbookWithSheets: async (workbook: Workbook): Promise<void> => {
      const state = get();
      const engine = new RecalculationEngine(workbook.sheets, workbook.activeSheetId);
      const result = engine.recalculateAll();

      let cellStyles: Record<string, CellStyle> = {};
      let conditionalFormats: ConditionalFormat[] = [];
      let charts: Chart[] = [];
      let history: Operation[] = [];

      try {
        const [stylesRes, formatsRes, chartsRes, opsRes] = await Promise.all([
          fetch(`/api/workbooks/${workbook.id}/styles`),
          fetch(`/api/workbooks/${workbook.id}/conditional-formats`),
          fetch(`/api/workbooks/${workbook.id}/charts`),
          fetch(`/api/workbooks/${workbook.id}/operations`)
        ]);

        if (stylesRes.ok) {
          const data = await stylesRes.json();
          const styles: CellStyle[] = data.data || [];
          cellStyles = {};
          styles.forEach(s => {
            cellStyles[getCellStyleKey(s.sheetId, s.cellId)] = s;
          });
        }

        if (formatsRes.ok) {
          const data = await formatsRes.json();
          conditionalFormats = data.data || [];
        }

        if (chartsRes.ok) {
          const data = await chartsRes.json();
          charts = data.data || [];
        }

        if (opsRes.ok) {
          const data = await opsRes.json();
          history = data.data || [];
        }
      } catch (error) {
        console.error('Failed to load workbook data:', error);
      }

      set({
        sheets: workbook.sheets,
        activeSheetId: workbook.activeSheetId,
        cells: engine.getCells(workbook.activeSheetId),
        selectedCell: 'A1',
        editingCell: null,
        formulaBarValue: '',
        workbookId: workbook.id || null,
        workbookName: workbook.name,
        engine,
        recalculationTime: result.recalculationTime,
        circularCells: result.circularCells,
        version: workbook.version,
        cellStyles,
        conditionalFormats,
        charts,
        history,
        historyIndex: history.length - 1,
        undoStack: [],
        redoStack: []
      });
    },

    saveWorkbookWithSheets: async (): Promise<boolean> => {
      const state = get();
      const workbookData = {
        name: state.workbookName,
        sheets: state.sheets,
        activeSheetId: state.activeSheetId,
        version: state.version
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
          const newWorkbookId = data.data.id;
          set({ workbookId: newWorkbookId, version: data.data.version });
          await get().loadWorkbookList();
          
          if (newWorkbookId && !state.wsConnected) {
            get().connectWebSocket(newWorkbookId);
          }
          
          return true;
        }
        return false;
      } catch (error) {
        console.error('Failed to save workbook:', error);
        return false;
      }
    },

    addConditionalFormat: async (format: Omit<ConditionalFormat, 'id'>): Promise<void> => {
      const state = get();
      if (!state.workbookId) return;

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/conditional-formats`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(format)
        });

        if (response.ok) {
          const data = await response.json();
          const newFormat: ConditionalFormat = data.data;

          const operation = createOperation('conditionalFormatAdd', format.sheetId,
            { format: newFormat },
            { id: newFormat.id }
          );

          set({
            conditionalFormats: [...state.conditionalFormats, newFormat],
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to add conditional format:', error);
      }
    },

    updateConditionalFormat: async (id: string, updates: Partial<ConditionalFormat>): Promise<void> => {
      const state = get();
      const format = state.conditionalFormats.find(f => f.id === id);
      if (!format) return;

      try {
        const response = await fetch(`/api/conditional-formats/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (response.ok) {
          const data = await response.json();
          const updatedFormat: ConditionalFormat = data.data;

          const operation = createOperation('conditionalFormatUpdate', format.sheetId,
            { format: updatedFormat },
            { format }
          );

          set({
            conditionalFormats: state.conditionalFormats.map(f => 
              f.id === id ? updatedFormat : f
            ),
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to update conditional format:', error);
      }
    },

    deleteConditionalFormat: async (id: string): Promise<void> => {
      const state = get();
      const format = state.conditionalFormats.find(f => f.id === id);
      if (!format) return;

      try {
        const response = await fetch(`/api/conditional-formats/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const operation = createOperation('conditionalFormatRemove', format.sheetId,
            { id },
            { format }
          );

          set({
            conditionalFormats: state.conditionalFormats.filter(f => f.id !== id),
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to delete conditional format:', error);
      }
    },

    addChart: async (chart: Omit<Chart, 'id'>): Promise<void> => {
      const state = get();
      if (!state.workbookId) return;

      try {
        const response = await fetch(`/api/workbooks/${state.workbookId}/charts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chart)
        });

        if (response.ok) {
          const data = await response.json();
          const newChart: Chart = data.data;

          const operation = createOperation('chartAdd', chart.sheetId,
            { chart: newChart },
            { id: newChart.id }
          );

          set({
            charts: [...state.charts, newChart],
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to add chart:', error);
      }
    },

    deleteChart: async (id: string): Promise<void> => {
      const state = get();
      const chart = state.charts.find(c => c.id === id);
      if (!chart) return;

      try {
        const response = await fetch(`/api/charts/${id}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          const operation = createOperation('chartRemove', chart.sheetId,
            { id },
            { chart }
          );

          set({
            charts: state.charts.filter(c => c.id !== id),
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to delete chart:', error);
      }
    },

    setActivePanel: (panel: 'sheets' | 'charts' | 'collaboration' | 'history' | null) => {
      set({ activePanel: panel });
    },

    updateChart: async (id: string, updates: Partial<Chart>): Promise<void> => {
      const state = get();
      const chart = state.charts.find(c => c.id === id);
      if (!chart || !state.workbookId) return;

      try {
        const response = await fetch(`/api/charts/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates)
        });

        if (response.ok) {
          const data = await response.json();
          const updatedChart: Chart = data.data;

          const operation = createOperation('chartUpdate', chart.sheetId,
            { format: updatedChart },
            { format: chart }
          );

          set({
            charts: state.charts.map(c =>
              c.id === id ? updatedChart : c
            ),
            history: [operation, ...state.history].slice(0, MAX_STACK_SIZE)
          });

          state.pushToUndoStack(operation);
          state.broadcastOperation(operation);
        }
      } catch (error) {
        console.error('Failed to update chart:', error);
      }
    },

    toggleSheetVisibility: (sheetId: string): void => {
      const state = get();
      const sheet = state.sheets.find(s => s.id === sheetId);
      if (!sheet) return;

      const newSheets = state.sheets.map(s =>
        s.id === sheetId ? { ...s, isHidden: !s.isHidden } : s
      );

      let newActiveSheetId = state.activeSheetId;
      if (sheet.isHidden === false && state.activeSheetId === sheetId) {
        const visibleSheet = newSheets.find(s => !s.isHidden);
        if (visibleSheet) {
          newActiveSheetId = visibleSheet.id;
        }
      }

      state.engine.setSheets(newSheets, newActiveSheetId);

      set({
        sheets: newSheets,
        activeSheetId: newActiveSheetId,
        cells: state.engine.getCells(newActiveSheetId)
      });
    },

    setSheetTabColor: (sheetId: string, color: string): void => {
      const state = get();
      const newSheets = state.sheets.map(s =>
        s.id === sheetId ? { ...s, tabColor: color === 'transparent' ? undefined : color } : s
      );
      set({ sheets: newSheets });
    },

    jumpToVersion: (index: number): void => {
      const state = get();
      if (index < -1 || index >= state.history.length - 1) return;

      const targetIndex = state.history.length - 1 - index;
      
      set({ historyIndex: targetIndex });

      if (index === -1) {
        return;
      }

      const operationsToUndo = state.historyIndex - targetIndex;
      for (let i = 0; i < operationsToUndo; i++) {
        const operation = state.history[state.historyIndex - i];
        if (operation) {
          state.reverseOperation(operation);
        }
      }

      const operationsToRedo = targetIndex - state.historyIndex;
      for (let i = 0; i < operationsToRedo; i++) {
        const operation = state.history[state.historyIndex + 1 + i];
        if (operation) {
          state.applyOperation(operation);
        }
      }
    }
  };
});
