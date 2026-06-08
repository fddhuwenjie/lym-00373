import React, { useCallback, useEffect, useState } from 'react';
import { Toolbar } from '../components/Spreadsheet/Toolbar';
import { FormulaBar } from '../components/Spreadsheet/FormulaBar';
import { VirtualGrid } from '../components/Spreadsheet/VirtualGrid';
import { SheetTabs } from '../components/SheetTabs';
import { SheetsPanel } from '../components/panels/SheetsPanel';
import { ChartsPanel } from '../components/panels/ChartsPanel';
import { CollaborationPanel } from '../components/panels/CollaborationPanel';
import { HistoryPanel } from '../components/panels/HistoryPanel';
import { ConditionalFormatPanel } from '../components/ConditionalFormatPanel';
import { ChartOverlay } from '../components/ChartOverlay';
import { useSpreadsheetStore } from '../store/useSpreadsheetStore';
import type { Chart } from '../../shared/types';

const ROWS = 100;
const COLS = 26;

const Home: React.FC = () => {
  const setSelectedCell = useSpreadsheetStore(state => state.setSelectedCell);
  const setEditingCell = useSpreadsheetStore(state => state.setEditingCell);
  const updateCell = useSpreadsheetStore(state => state.updateCell);
  const formulaBarValue = useSpreadsheetStore(state => state.formulaBarValue);
  const setFormulaBarValue = useSpreadsheetStore(state => state.setFormulaBarValue);
  const loadWorkbookList = useSpreadsheetStore(state => state.loadWorkbookList);
  const saveWorkbook = useSpreadsheetStore(state => state.saveWorkbook);
  const undo = useSpreadsheetStore(state => state.undo);
  const redo = useSpreadsheetStore(state => state.redo);

  const sheets = useSpreadsheetStore(state => state.sheets);
  const activeSheetId = useSpreadsheetStore(state => state.activeSheetId);
  const setActiveSheet = useSpreadsheetStore(state => state.setActiveSheet);
  const createSheet = useSpreadsheetStore(state => state.createSheet);
  const renameSheet = useSpreadsheetStore(state => state.renameSheet);
  const deleteSheet = useSpreadsheetStore(state => state.deleteSheet);
  const copySheet = useSpreadsheetStore(state => state.copySheet);
  const reorderSheet = useSpreadsheetStore(state => state.reorderSheet);
  const setSheetTabColor = useSpreadsheetStore(state => state.setSheetTabColor);

  const activePanel = useSpreadsheetStore(state => state.activePanel);
  const setActivePanel = useSpreadsheetStore(state => state.setActivePanel);

  const charts = useSpreadsheetStore(state => state.charts);
  const deleteChart = useSpreadsheetStore(state => state.deleteChart);
  const updateChart = useSpreadsheetStore(state => state.updateChart);

  const [showConditionalFormat, setShowConditionalFormat] = useState(false);
  const [openCharts, setOpenCharts] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadWorkbookList();
  }, [loadWorkbookList]);

  useEffect(() => {
    if (charts.length > 0) {
      const newChartIds = charts.map(c => c.id);
      setOpenCharts(prev => {
        const next = new Set(prev);
        newChartIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [charts.length]);

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
      
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveWorkbook();
        return;
      }

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
  }, [setSelectedCell, setEditingCell, setFormulaBarValue, updateCell, saveWorkbook]);

  const handleCloseChart = (chartId: string) => {
    setOpenCharts(prev => {
      const next = new Set(prev);
      next.delete(chartId);
      return next;
    });
  };

  const handleUpdateChart = (chart: Chart) => {
    updateChart(chart.id, chart);
  };

  const renderActivePanel = () => {
    switch (activePanel) {
      case 'sheets':
        return <SheetsPanel onClose={() => setActivePanel(null)} />;
      case 'charts':
        return <ChartsPanel onClose={() => setActivePanel(null)} />;
      case 'collaboration':
        return <CollaborationPanel onClose={() => setActivePanel(null)} />;
      case 'history':
        return <HistoryPanel onClose={() => setActivePanel(null)} />;
      default:
        return null;
    }
  };

  const activeSheetCharts = charts.filter(c => c.sheetId === activeSheetId);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">
      <header className="bg-gradient-to-r from-blue-800 to-blue-900 text-white px-6 py-3 shadow-lg flex-shrink-0">
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
      
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 overflow-hidden relative">
          <VirtualGrid 
            onCellClick={handleCellClick}
            onCellDoubleClick={handleCellDoubleClick}
          />
          
          {activeSheetCharts.map(chart => (
            openCharts.has(chart.id) && (
              <ChartOverlay
                key={chart.id}
                chart={chart}
                onClose={() => handleCloseChart(chart.id)}
                onUpdate={handleUpdateChart}
              />
            )
          ))}
        </div>
        
        {activePanel && (
          <div className="flex-shrink-0">
            {renderActivePanel()}
          </div>
        )}
      </div>
      
      <SheetTabs
        sheets={sheets}
        activeSheetId={activeSheetId}
        onActiveSheetChange={setActiveSheet}
        onRenameSheet={renameSheet}
        onDeleteSheet={deleteSheet}
        onCopySheet={copySheet}
        onReorderSheet={reorderSheet}
        onCreateSheet={createSheet}
        onTabColorChange={setSheetTabColor}
      />

      <ConditionalFormatPanel
        isOpen={showConditionalFormat}
        onClose={() => setShowConditionalFormat(false)}
      />
    </div>
  );
};

export default Home;
