import React, { useRef, useEffect } from 'react';
import { Equal } from 'lucide-react';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';

export const FormulaBar: React.FC = () => {
  const selectedCell = useSpreadsheetStore(state => state.selectedCell);
  const formulaBarValue = useSpreadsheetStore(state => state.formulaBarValue);
  const setFormulaBarValue = useSpreadsheetStore(state => state.setFormulaBarValue);
  const updateCell = useSpreadsheetStore(state => state.updateCell);
  const cells = useSpreadsheetStore(state => state.cells);
  const editingCell = useSpreadsheetStore(state => state.editingCell);
  const setEditingCell = useSpreadsheetStore(state => state.setEditingCell);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCommit = () => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      if (formulaBarValue !== (cell?.rawValue || '')) {
        updateCell(selectedCell, formulaBarValue);
      }
      setEditingCell(null);
    }
  };

  const handleCancel = () => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      setFormulaBarValue(cell?.formula || cell?.rawValue || '');
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleCommit();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200">
      <div className="w-20 px-3 py-1.5 bg-white border border-gray-300 rounded text-center font-mono text-sm font-medium text-gray-700">
        {selectedCell || ''}
      </div>
      
      <div className="flex items-center px-2 text-gray-500">
        <Equal size={16} />
      </div>
      
      <input
        ref={inputRef}
        type="text"
        className="flex-1 px-3 py-1.5 bg-white border border-gray-300 rounded text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        style={{ fontFamily: '"JetBrains Mono", monospace' }}
        value={formulaBarValue}
        onChange={(e) => setFormulaBarValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => selectedCell && setEditingCell(selectedCell)}
        onBlur={handleCommit}
        placeholder="Enter value or formula (e.g., =SUM(A1:A10))"
      />
      
      <div className="flex items-center gap-1">
        <button
          onClick={handleCancel}
          className="px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded text-sm transition-colors"
          title="Cancel"
        >
          ✕
        </button>
        <button
          onClick={handleCommit}
          className="px-3 py-1.5 text-green-600 hover:bg-green-50 rounded text-sm transition-colors"
          title="Confirm"
        >
          ✓
        </button>
      </div>
    </div>
  );
};
