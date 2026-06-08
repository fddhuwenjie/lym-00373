import React, { useState } from 'react';
import { 
  FilePlus, 
  Save, 
  FolderOpen, 
  Download, 
  Trash2, 
  Bold, 
  Italic, 
  AlignLeft,
  ListOrdered,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { useSpreadsheetStore } from '../../store/useSpreadsheetStore';

export const Toolbar: React.FC = () => {
  const [showWorkbookList, setShowWorkbookList] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);

  const workbookName = useSpreadsheetStore(state => state.workbookName);
  const workbookId = useSpreadsheetStore(state => state.workbookId);
  const workbooks = useSpreadsheetStore(state => state.workbooks);
  const selectedCell = useSpreadsheetStore(state => state.selectedCell);
  const setWorkbookName = useSpreadsheetStore(state => state.setWorkbookName);
  const newWorkbook = useSpreadsheetStore(state => state.newWorkbook);
  const saveWorkbook = useSpreadsheetStore(state => state.saveWorkbook);
  const loadWorkbookList = useSpreadsheetStore(state => state.loadWorkbookList);
  const loadWorkbookById = useSpreadsheetStore(state => state.loadWorkbookById);
  const deleteWorkbook = useSpreadsheetStore(state => state.deleteWorkbook);
  const exportCSV = useSpreadsheetStore(state => state.exportCSV);
  const setCellFormat = useSpreadsheetStore(state => state.setCellFormat);
  const cells = useSpreadsheetStore(state => state.cells);

  const handleNew = () => {
    newWorkbook();
    setShowWorkbookList(false);
  };

  const handleSave = async () => {
    await saveWorkbook();
  };

  const handleLoad = async () => {
    await loadWorkbookList();
    setShowWorkbookList(!showWorkbookList);
  };

  const handleLoadWorkbook = (id: number) => {
    loadWorkbookById(id);
    setShowWorkbookList(false);
  };

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this workbook?')) {
      deleteWorkbook(id);
    }
  };

  const handleExportCSV = () => {
    exportCSV();
  };

  const handleToggleBold = () => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      setCellFormat(selectedCell, { isBold: !cell?.format?.isBold });
    }
  };

  const handleToggleItalic = () => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      setCellFormat(selectedCell, { isItalic: !cell?.format?.isItalic });
    }
  };

  const handleSetDecimalPlaces = (places: number) => {
    if (selectedCell) {
      setCellFormat(selectedCell, { decimalPlaces: places });
    }
    setShowFormatMenu(false);
  };

  const handleToggleThousandsSeparator = () => {
    if (selectedCell) {
      const cell = cells[selectedCell];
      setCellFormat(selectedCell, { useThousandsSeparator: !cell?.format?.useThousandsSeparator });
    }
  };

  const handleSetDateFormat = (format: 'YYYY-MM-DD' | 'MM/DD/YYYY') => {
    if (selectedCell) {
      setCellFormat(selectedCell, { dateFormat: format });
    }
    setShowFormatMenu(false);
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-1 px-3 py-2 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 pr-3 border-r border-gray-200">
          <input
            type="text"
            className="px-2 py-1 border border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none rounded text-sm font-medium text-gray-800 min-w-[150px]"
            value={workbookName}
            onChange={(e) => setWorkbookName(e.target.value)}
            placeholder="Workbook name"
          />
        </div>

        <div className="flex items-center gap-1 px-3 border-r border-gray-200">
          <button
            onClick={handleNew}
            className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-700"
            title="New workbook"
          >
            <FilePlus size={18} />
          </button>
          <button
            onClick={handleSave}
            className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-700"
            title="Save"
          >
            <Save size={18} />
          </button>
          <div className="relative">
            <button
              onClick={handleLoad}
              className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-700 flex items-center gap-1"
              title="Load workbook"
            >
              <FolderOpen size={18} />
              <ChevronDown size={14} />
            </button>
            
            {showWorkbookList && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[250px] max-h-[300px] overflow-y-auto">
                {workbooks.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-gray-500">No saved workbooks</div>
                ) : (
                  workbooks.map(wb => (
                    <div
                      key={wb.id}
                      onClick={() => handleLoadWorkbook(wb.id)}
                      className="flex items-center justify-between px-4 py-2 hover:bg-gray-50 cursor-pointer group"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{wb.name}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(wb.updatedAt).toLocaleString()}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(wb.id, e)}
                        className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={handleExportCSV}
            className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-700"
            title="Export CSV"
          >
            <Download size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 border-r border-gray-200">
          <button
            onClick={handleToggleBold}
            className={`p-2 rounded transition-colors ${cells[selectedCell || '']?.format?.isBold ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
            title="Bold"
          >
            <Bold size={18} />
          </button>
          <button
            onClick={handleToggleItalic}
            className={`p-2 rounded transition-colors ${cells[selectedCell || '']?.format?.isItalic ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
            title="Italic"
          >
            <Italic size={18} />
          </button>
        </div>

        <div className="flex items-center gap-1 px-3 relative">
          <div className="relative">
            <button
              onClick={() => setShowFormatMenu(!showFormatMenu)}
              className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-700 flex items-center gap-1"
              title="Number format"
            >
              <ListOrdered size={18} />
              <ChevronDown size={14} />
            </button>

            {showFormatMenu && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px]">
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-b">Decimal Places</div>
                {[0, 1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => handleSetDecimalPlaces(n)}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
                  >
                    {n} decimal place{n !== 1 ? 's' : ''}
                  </button>
                ))}
                <div className="border-t border-gray-100 my-1"></div>
                <button
                  onClick={handleToggleThousandsSeparator}
                  className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 ${cells[selectedCell || '']?.format?.useThousandsSeparator ? 'text-blue-600 font-medium' : 'text-gray-700'}`}
                >
                  ✓ Thousands separator
                </button>
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase border-t border-b">Date Format</div>
                <button
                  onClick={() => handleSetDateFormat('YYYY-MM-DD')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
                >
                  YYYY-MM-DD (2024-01-15)
                </button>
                <button
                  onClick={() => handleSetDateFormat('MM/DD/YYYY')}
                  className="w-full px-4 py-2 text-left text-sm hover:bg-gray-50 text-gray-700"
                >
                  MM/DD/YYYY (01/15/2024)
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => handleSetDateFormat('YYYY-MM-DD')}
            className="p-2 hover:bg-gray-100 rounded transition-colors text-gray-700"
            title="Date format"
          >
            <Calendar size={18} />
          </button>
          <button
            onClick={handleToggleThousandsSeparator}
            className={`p-2 rounded transition-colors ${cells[selectedCell || '']?.format?.useThousandsSeparator ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-100 text-gray-700'}`}
            title="Thousands separator"
          >
            <ListOrdered size={18} />
          </button>
        </div>
      </div>

      {showWorkbookList && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowWorkbookList(false)}
        />
      )}
      {showFormatMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowFormatMenu(false)}
        />
      )}
    </div>
  );
};
