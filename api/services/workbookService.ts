import { WorkbookRepository, SheetRepository } from '../repositories/workbookRepository';
import { CellStyleRepository } from '../repositories/cellStyleRepository';
import { ConditionalFormatRepository } from '../repositories/conditionalFormatRepository';
import { ChartRepository } from '../repositories/chartRepository';
import { OperationRepository } from '../repositories/operationRepository';
import type { Workbook, WorkbookListItem, Sheet, CellStyle, ConditionalFormat, Chart, Operation, Cell } from '../../shared/types';
import * as XLSX from 'xlsx';

export class WorkbookService {
  static getAllWorkbooks(): WorkbookListItem[] {
    return WorkbookRepository.findAll();
  }

  static getWorkbook(id: number): Workbook | null {
    return WorkbookRepository.findById(id);
  }

  static getWorkbookFull(id: number): {
    workbook: Workbook;
    styles: CellStyle[];
    conditionalFormats: ConditionalFormat[];
    charts: Chart[];
    version: number;
  } | null {
    const workbook = WorkbookRepository.findById(id);
    if (!workbook) return null;

    return {
      workbook,
      styles: CellStyleRepository.findAll(id),
      conditionalFormats: ConditionalFormatRepository.findAll(id),
      charts: ChartRepository.findAll(id),
      version: workbook.version
    };
  }

  static createWorkbook(name: string): Workbook {
    const workbook = WorkbookRepository.create({ name, sheets: [], activeSheetId: '' });
    return workbook;
  }

  static updateWorkbook(id: number, name: string, sheets: Sheet[], activeSheetId: string): Workbook | null {
    return WorkbookRepository.update(id, { name, sheets, activeSheetId });
  }

  static deleteWorkbook(id: number): boolean {
    CellStyleRepository.deleteBySheet(id, '');
    ConditionalFormatRepository.deleteBySheet(id, '');
    ChartRepository.deleteBySheet(id, '');
    OperationRepository.deleteByWorkbook(id);
    return WorkbookRepository.delete(id);
  }

  static getSheets(workbookId: number): Sheet[] | null {
    return SheetRepository.findAll(workbookId);
  }

  static createSheet(workbookId: number, name?: string): Sheet | null {
    return SheetRepository.create(workbookId, name);
  }

  static updateSheet(workbookId: number, sheetId: string, updates: Partial<Omit<Sheet, 'id'>>): Sheet | null {
    return SheetRepository.update(workbookId, sheetId, updates);
  }

  static deleteSheet(workbookId: number, sheetId: string): boolean {
    const result = SheetRepository.delete(workbookId, sheetId);
    if (result) {
      SheetRepository.markRefsAsError(workbookId, sheetId);
      CellStyleRepository.deleteBySheet(workbookId, sheetId);
      ConditionalFormatRepository.deleteBySheet(workbookId, sheetId);
      ChartRepository.deleteBySheet(workbookId, sheetId);
    }
    return result;
  }

  static reorderSheet(workbookId: number, sheetId: string, newIndex: number): Sheet[] | null {
    return SheetRepository.reorder(workbookId, sheetId, newIndex);
  }

  static copySheet(workbookId: number, sheetId: string): Sheet | null {
    return SheetRepository.copy(workbookId, sheetId);
  }

  static getCellStyles(workbookId: number, sheetId?: string): CellStyle[] {
    return CellStyleRepository.findAll(workbookId, sheetId);
  }

  static updateCellStyle(workbookId: number, sheetId: string, cellId: string, updates: Partial<CellStyle>): CellStyle | null {
    return CellStyleRepository.update(workbookId, sheetId, cellId, updates);
  }

  static deleteCellStyle(workbookId: number, sheetId: string, cellId: string): boolean {
    return CellStyleRepository.delete(workbookId, sheetId, cellId);
  }

  static getConditionalFormats(workbookId: number, sheetId?: string): ConditionalFormat[] {
    return ConditionalFormatRepository.findAll(workbookId, sheetId);
  }

  static createConditionalFormat(format: Omit<ConditionalFormat, 'id'>): ConditionalFormat {
    return ConditionalFormatRepository.create(format);
  }

  static updateConditionalFormat(id: string, updates: Partial<ConditionalFormat>): ConditionalFormat | null {
    return ConditionalFormatRepository.update(id, updates);
  }

  static deleteConditionalFormat(id: string): boolean {
    return ConditionalFormatRepository.delete(id);
  }

  static getCharts(workbookId: number, sheetId?: string): Chart[] {
    return ChartRepository.findAll(workbookId, sheetId);
  }

  static createChart(chart: Omit<Chart, 'id'>): Chart {
    return ChartRepository.create(chart);
  }

  static updateChart(id: string, updates: Partial<Chart>): Chart | null {
    return ChartRepository.update(id, updates);
  }

  static deleteChart(id: string): boolean {
    return ChartRepository.delete(id);
  }

  static getOperations(workbookId: number, limit?: number): Operation[] {
    return OperationRepository.findAll(workbookId, limit);
  }

  static getOperationsSince(workbookId: number, version: number): Operation[] {
    return OperationRepository.findSinceVersion(workbookId, version);
  }

  static createOperation(operation: Omit<Operation, 'id'> & { workbookId: number; version: number }): Operation {
    return OperationRepository.create(operation);
  }

  static getMaxLamportTime(workbookId: number): number {
    return OperationRepository.getMaxLamportTime(workbookId);
  }

  static getVersion(workbookId: number): number {
    return WorkbookRepository.getVersion(workbookId);
  }

  static updateVersion(workbookId: number, version: number): boolean {
    return WorkbookRepository.updateVersion(workbookId, version);
  }

  static exportToCSV(workbook: Workbook, sheetId?: string): string {
    const sheets = sheetId ? workbook.sheets.filter(s => s.id === sheetId) : workbook.sheets;
    const results: string[] = [];

    for (const sheet of sheets) {
      if (sheets.length > 1) {
        results.push(`"${sheet.name}"`);
      }
      results.push(this.exportSheetToCSV(sheet));
      if (sheets.length > 1) {
        results.push('');
      }
    }

    return results.join('\n');
  }

  private static exportSheetToCSV(sheet: Sheet): string {
    const maxRows = 100;
    const maxCols = 26;
    
    const rows: string[] = [];
    
    for (let row = 1; row <= maxRows; row++) {
      const rowData: string[] = [];
      for (let col = 0; col < maxCols; col++) {
        const colLetter = String.fromCharCode(65 + col);
        const cellId = `${colLetter}${row}`;
        const cell = sheet.cells[cellId];
        
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
    
    return rows.join('\n');
  }

  static exportToXLSX(workbook: Workbook, styles: CellStyle[], conditionalFormats: ConditionalFormat[]): Buffer {
    const wb = XLSX.utils.book_new();

    for (const sheet of workbook.sheets.sort((a, b) => a.index - b.index)) {
      const aoa: unknown[][] = [];
      const maxRows = 100;
      const maxCols = 26;

      for (let row = 0; row < maxRows; row++) {
        aoa[row] = [];
        for (let col = 0; col < maxCols; col++) {
          const colLetter = String.fromCharCode(65 + col);
          const cellId = `${colLetter}${row + 1}`;
          const cell = sheet.cells[cellId];
          
          if (cell) {
            if (cell.formula) {
              aoa[row][col] = { f: cell.formula.substring(1) };
            } else if (cell.value instanceof Date) {
              aoa[row][col] = cell.value;
            } else if (cell.value !== null && cell.value !== undefined) {
              aoa[row][col] = cell.value;
            }

            const cellStyle = styles.find(s => s.sheetId === sheet.id && s.cellId === cellId);
            if (cellStyle) {
              (aoa[row][col] as XLSX.CellObject).s = {
                font: {
                  bold: cellStyle.bold,
                  italic: cellStyle.italic,
                  color: cellStyle.fontColor ? { rgb: cellStyle.fontColor.replace('#', '') } : undefined
                },
                fill: cellStyle.bgColor ? {
                  fgColor: { rgb: cellStyle.bgColor.replace('#', '') },
                  patternType: 'solid'
                } : undefined,
                alignment: cellStyle.align ? {
                  horizontal: cellStyle.align
                } : undefined,
                numFmt: cellStyle.numberFormat ? {
                  format: cellStyle.numberFormat
                } : undefined
              };
            }
          }
        }
      }

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      XLSX.utils.book_append_sheet(wb, ws, sheet.name);
    }

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', cellStyles: true });
  }

  static importFromXLSX(workbookId: number, buffer: Buffer): { workbook: Workbook; styles: CellStyle[] } | null {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return null;

    const wb = XLSX.read(buffer, { type: 'buffer', cellStyles: true, cellFormula: true });
    const sheets: Sheet[] = [];
    const styles: CellStyle[] = [];

    for (let i = 0; i < wb.SheetNames.length; i++) {
      const sheetName = wb.SheetNames[i];
      const ws = wb.Sheets[sheetName];
      const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:A1');
      
      const cells: Record<string, Cell> = {};
      const sheetId = i === 0 && workbook.sheets[0] ? workbook.sheets[0].id : `sheet_${Date.now()}_${i}`;

      for (let row = range.s.r; row <= Math.min(range.e.r, 99); row++) {
        for (let col = range.s.c; col <= Math.min(range.e.c, 25); col++) {
          const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
          const xlsxCell = ws[cellAddr];
          
          if (xlsxCell) {
            const cellId = cellAddr;
            const cell: Cell = {
              id: cellId,
              type: 'text',
              rawValue: '',
              value: null,
              isError: false,
              isCircular: false
            };

            if (xlsxCell.f) {
              cell.type = 'formula';
              cell.formula = `=${this.mapExcelFormula(xlsxCell.f)}`;
              cell.rawValue = cell.formula;
              cell.value = xlsxCell.v !== undefined ? xlsxCell.v : null;
            } else if (xlsxCell.t === 'n') {
              cell.type = 'number';
              cell.value = xlsxCell.v as number;
              cell.rawValue = String(xlsxCell.v);
            } else if (xlsxCell.t === 'd') {
              cell.type = 'date';
              cell.value = xlsxCell.v as Date;
              cell.rawValue = (xlsxCell.v as Date).toISOString().split('T')[0];
            } else if (xlsxCell.t === 'b') {
              cell.type = 'text';
              cell.value = xlsxCell.v as boolean;
              cell.rawValue = String(xlsxCell.v).toUpperCase();
            } else if (xlsxCell.t === 'e') {
              cell.type = 'error';
              cell.isError = true;
              cell.errorMessage = xlsxCell.w || '#ERROR!';
              cell.value = cell.errorMessage;
              cell.rawValue = cell.errorMessage;
            } else {
              cell.type = 'text';
              cell.value = xlsxCell.v !== undefined ? String(xlsxCell.v) : '';
              cell.rawValue = cell.value as string;
            }

            if (xlsxCell.s) {
              const style: CellStyle = {
                id: `${sheetId}_${cellId}`,
                workbookId,
                sheetId,
                cellId,
                bold: xlsxCell.s.font?.bold,
                italic: xlsxCell.s.font?.italic,
                fontColor: xlsxCell.s.font?.color?.rgb ? `#${xlsxCell.s.font.color.rgb}` : undefined,
                bgColor: xlsxCell.s.fill?.fgColor?.rgb ? `#${xlsxCell.s.fill.fgColor.rgb}` : undefined,
                align: xlsxCell.s.alignment?.horizontal as 'left' | 'center' | 'right' | undefined,
                numberFormat: xlsxCell.s.numFmt?.format
              };
              styles.push(style);
            }

            cells[cellId] = cell;
          }
        }
      }

      sheets.push({
        id: sheetId,
        name: sheetName,
        index: i,
        cells,
        isHidden: false
      });
    }

    const updatedWorkbook = WorkbookRepository.update(workbookId, {
      name: workbook.name,
      sheets,
      activeSheetId: sheets[0]?.id || ''
    });

    for (const style of styles) {
      CellStyleRepository.create(style);
    }

    return updatedWorkbook ? { workbook: updatedWorkbook, styles } : null;
  }

  private static mapExcelFormula(formula: string): string {
    const formulaMap: Record<string, string> = {
      'SUMIF': 'SUMIF',
      'COUNTIF': 'COUNTIF',
      'SUMIFS': 'SUMIFS',
      'COUNTIFS': 'COUNTIFS',
      'INDEX': 'INDEX',
      'MATCH': 'MATCH',
      'INDIRECT': 'INDIRECT',
      'TEXT': 'TEXT',
      'DATE': 'DATE',
      'NOW': 'NOW',
      'TODAY': 'TODAY',
      'TRIM': 'TRIM',
      'UPPER': 'UPPER',
      'LOWER': 'LOWER',
      'SUBTOTAL': 'SUM',
      'ROUNDUP': 'ROUND',
      'ROUNDDOWN': 'ROUND',
      'INT': 'ROUND',
      'ABS': 'ABS',
      'MOD': 'MOD',
      'POWER': 'POWER',
      'SQRT': 'SQRT',
      'EXP': 'EXP',
      'LN': 'LN',
      'LOG': 'LOG',
      'LOG10': 'LOG10',
      'SIN': 'SIN',
      'COS': 'COS',
      'TAN': 'TAN',
      'PI': 'PI',
      'RAND': 'RAND',
      'RANDBETWEEN': 'RANDBETWEEN',
      'FIND': 'FIND',
      'SEARCH': 'SEARCH',
      'LEFT': 'LEFT',
      'RIGHT': 'RIGHT',
      'MID': 'MID',
      'REPLACE': 'REPLACE',
      'SUBSTITUTE': 'SUBSTITUTE',
      'REPT': 'REPT',
      'CONCATENATE': 'CONCAT',
      'TEXTJOIN': 'CONCAT',
      'EXACT': 'EXACT',
      'VALUE': 'VALUE',
      'T': 'T',
      'N': 'N',
      'TYPE': 'TYPE',
      'ISNUMBER': 'ISNUMBER',
      'ISTEXT': 'ISTEXT',
      'ISLOGICAL': 'ISLOGICAL',
      'ISBLANK': 'ISBLANK',
      'ISERROR': 'ISERROR',
      'ISNA': 'ISNA',
      'IFERROR': 'IFERROR',
      'IFS': 'IFS',
      'SWITCH': 'SWITCH',
      'CHOOSE': 'CHOOSE',
      'AND': 'AND',
      'OR': 'OR',
      'NOT': 'NOT',
      'XOR': 'XOR',
      'TRUE': 'TRUE',
      'FALSE': 'FALSE',
      'RANK': 'RANK',
      'PERCENTILE': 'PERCENTILE',
      'QUARTILE': 'QUARTILE',
      'MEDIAN': 'MEDIAN',
      'MODE': 'MODE',
      'STDEV': 'STDEV',
      'STDEVP': 'STDEVP',
      'VAR': 'VAR',
      'VARP': 'VARP',
      'SKEW': 'SKEW',
      'KURT': 'KURT',
      'CORREL': 'CORREL',
      'COVAR': 'COVAR',
      'FORECAST': 'FORECAST',
      'TREND': 'TREND',
      'GROWTH': 'GROWTH',
      'LINEST': 'LINEST',
      'LOGEST': 'LOGEST',
      'SLOPE': 'SLOPE',
      'INTERCEPT': 'INTERCEPT',
      'RSQ': 'RSQ',
      'STEYX': 'STEYX'
    };

    let result = formula;
    for (const [excelFunc, ourFunc] of Object.entries(formulaMap)) {
      const regex = new RegExp(`\\b${excelFunc}\\b`, 'gi');
      result = result.replace(regex, ourFunc);
    }

    return result;
  }
}
