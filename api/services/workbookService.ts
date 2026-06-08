import { WorkbookRepository } from '../repositories/workbookRepository';
import type { Workbook, WorkbookListItem, Cell } from '../../shared/types';

export class WorkbookService {
  static getAllWorkbooks(): WorkbookListItem[] {
    return WorkbookRepository.findAll();
  }

  static getWorkbook(id: number): Workbook | null {
    return WorkbookRepository.findById(id);
  }

  static createWorkbook(name: string, cells: Record<string, Cell>): Workbook {
    return WorkbookRepository.create({ name, cells });
  }

  static updateWorkbook(id: number, name: string, cells: Record<string, Cell>): Workbook | null {
    return WorkbookRepository.update(id, { name, cells });
  }

  static deleteWorkbook(id: number): boolean {
    return WorkbookRepository.delete(id);
  }

  static exportToCSV(workbook: Workbook): string {
    const maxRows = 100;
    const maxCols = 26;
    
    const rows: string[] = [];
    
    for (let row = 1; row <= maxRows; row++) {
      const rowData: string[] = [];
      for (let col = 0; col < maxCols; col++) {
        const colLetter = String.fromCharCode(65 + col);
        const cellId = `${colLetter}${row}`;
        const cell = workbook.cells[cellId];
        
        if (cell && !cell.isError) {
          const value = cell.value;
          let strValue = '';
          
          if (value instanceof Date) {
            strValue = value.toISOString().split('T')[0];
          } else if (value !== null && value !== undefined) {
            strValue = String(value);
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
}
