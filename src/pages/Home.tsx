import React, { useCallback, useEffect } from 'react';
import { Toolbar } from '../components/Spreadsheet/Toolbar';
import { FormulaBar } from '../components/Spreadsheet/FormulaBar';
import { VirtualGrid } from '../components/Spreadsheet/VirtualGrid';
import { StatusBar } from '../components/Spreadsheet/StatusBar';
import { useSpreadsheetStore } from '../store/useSpreadsheetStore';

const ROWS = 100;
const COLS = 26;

const Home: React.FC = () => {
  const setSelectedCell = useSpreadsheetStore(state => state.setSelectedCell);
  const setEditingCell = useSpreadsheetStore(state => state.setEditingCell);
  const updateCell = useSpreadsheetStore(state => state.updateCell);
  const formulaBarValue = useSpreadsheetStore(state => state.formulaBarValue);
  const setFormulaBarValue = useSpreadsheetStore(state => state.setFormulaBarValue);
  const loadWorkbookList = useSpreadsheetStore(state => state.loadWorkbookList);

  useEffect(() => {
    loadWorkbookList();
  }, [loadWorkbookList]);

  const positionToCellId = (col: number, row: number): string => {
    return `${String.fromCharCode(65 + col)}${row + 1}`;
  };

  const cellIdToPosition = (cellId: string): { col: number; row: number } => {
    const col = cellId.charCodeAt(0) - 65;
    const row = parseInt(cellId.slice(1)) - 1;
    return { col, row };
  };

  const handleCellClick = useCallback((cellId: string, event: React.MouseEvent) => {
    const state = useSpreadsheetStore.getState();
    
    if (state.editingCell && state.editingCell !== cellId) {
      const editValue = state.formulaBarValue;
      const editingCell = state.cells[state.editingCell];
      if (editValue !== (editingCell?.rawValue || '')) {
        updateCell(state.editingCell, editValue);
      }
      setEditingCell(null);
    }
    
    setSelectedCell(cellId);
  }, [setSelectedCell, setEditingCell, updateCell]);

  const handleCellDoubleClick = useCallback((cellId: string) => {
    const state = useSpreadsheetStore.getState();
    const cell = state.cells[cellId];
    
    if (state.editingCell) {
      const editValue = state.formulaBarValue;
      const editingCell = state.cells[state.editingCell];
      if (editValue !== (editingCell?.rawValue || '')) {
        updateCell(state.editingCell, editValue);
      }
    }
    
    setSelectedCell(cellId);
    setFormulaBarValue(cell?.formula || cell?.rawValue || '');
    setEditingCell(cellId);
  }, [setSelectedCell, setEditingCell, setFormulaBarValue, updateCell]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = useSpreadsheetStore.getState();
      
      if (state.editingCell) return;
      
      const selectedCell = state.selectedCell;
      if (!selectedCell) return;
      
      const { col, row } = cellIdToPosition(selectedCell);
      let newCellId: string | null = null;
      
      if (e.key === 'ArrowUp' && row > 0) {
        e.preventDefault();
        newCellId = positionToCellId(col, row - 1);
      } else if (e.key === 'ArrowDown' && row < ROWS - 1) {
        e.preventDefault();
        newCellId = positionToCellId(col, row + 1);
      } else if (e.key === 'ArrowLeft' && col > 0) {
        e.preventDefault();
        newCellId = positionToCellId(col - 1, row);
      } else if (e.key === 'ArrowRight' && col < COLS - 1) {
        e.preventDefault();
        newCellId = positionToCellId(col + 1, row);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setEditingCell(selectedCell);
      } else if (e.key === 'F2') {
        e.preventDefault();
        setEditingCell(selectedCell);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        updateCell(selectedCell, '');
      } else if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        if (!e.key.startsWith('F')) {
          e.preventDefault();
          setEditingCell(selectedCell);
          setFormulaBarValue(e.key);
        }
      }
      
      if (newCellId) {
        setSelectedCell(newCellId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSelectedCell, setEditingCell, setFormulaBarValue, updateCell]);

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-gradient-to-r from-blue-800 to-blue-900 text-white px-6 py-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-white rounded flex items-center justify-center">
            <span className="text-blue-800 font-bold text-lg">Σ</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold">Spreadsheet</h1>
            <p className="text-xs text-blue-200">Excel-style formula engine with dependency graph</p>
          </div>
        </div>
      </header>
      
      <Toolbar />
      <FormulaBar />
      
      <div className="flex-1 flex overflow-hidden">
        <VirtualGrid 
          onCellClick={handleCellClick}
          onCellDoubleClick={handleCellDoubleClick}
        />
      </div>
      
      <StatusBar />
    </div>
  );
};

export default Home;
