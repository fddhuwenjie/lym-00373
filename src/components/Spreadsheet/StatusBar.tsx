import React from 'react';
import { AlertTriangle, Clock, Hash } from 'lucide-react';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';

export const StatusBar: React.FC = () => {
  const selectedCell = useSpreadsheetStore(state => state.selectedCell);
  const recalculationTime = useSpreadsheetStore(state => state.recalculationTime);
  const circularCells = useSpreadsheetStore(state => state.circularCells);
  const cells = useSpreadsheetStore(state => state.cells);
  const workbookName = useSpreadsheetStore(state => state.workbookName);

  const cellCount = Object.keys(cells).length;
  const formulaCount = Object.values(cells).filter(c => c.type === 'formula' && !c.isError).length;
  const errorCount = Object.values(cells).filter(c => c.isError && !c.isCircular).length;

  return (
    <div className="flex items-center justify-between px-4 py-1.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-600">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Hash size={12} />
          <span>{workbookName}</span>
        </div>
        <span className="text-gray-400">|</span>
        <div className="flex items-center gap-1">
          <span>{cellCount} cells</span>
        </div>
        <div className="flex items-center gap-1">
          <span>{formulaCount} formulas</span>
        </div>
        {errorCount > 0 && (
          <div className="flex items-center gap-1 text-amber-600">
            <AlertTriangle size={12} />
            <span>{errorCount} errors</span>
          </div>
        )}
        {circularCells.length > 0 && (
          <div className="flex items-center gap-1 text-red-600 animate-pulse">
            <AlertTriangle size={12} />
            <span>Cyclic reference in {circularCells.length} cells</span>
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-4">
        {selectedCell && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-gray-700">{selectedCell}</span>
            {cells[selectedCell] && (
              <span className="text-gray-500">
                {cells[selectedCell].type === 'formula' ? 'Formula' : 
                 cells[selectedCell].type === 'number' ? 'Number' :
                 cells[selectedCell].type === 'date' ? 'Date' : 'Text'}
              </span>
            )}
          </div>
        )}
        <span className="text-gray-400">|</span>
        <div className="flex items-center gap-1.5">
          <Clock size={12} />
          <span>Recalc: {recalculationTime.toFixed(2)}ms</span>
        </div>
      </div>
    </div>
  );
};
