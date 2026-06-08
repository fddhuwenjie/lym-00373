import { getDatabase, saveDatabase } from '../db/init';
import type { CellStyle } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface CellStyleRow {
  id: string;
  workbook_id: number;
  sheet_id: string;
  cell_id: string;
  font_color: string | null;
  bg_color: string | null;
  bold: number;
  italic: number;
  align: string | null;
  number_format: string | null;
}

function rowToCellStyle(row: CellStyleRow): CellStyle {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    cellId: row.cell_id,
    fontColor: row.font_color || undefined,
    bgColor: row.bg_color || undefined,
    bold: row.bold === 1,
    italic: row.italic === 1,
    align: (row.align as 'left' | 'center' | 'right') || undefined,
    numberFormat: row.number_format || undefined
  };
}

export class CellStyleRepository {
  static findAll(workbookId: number, sheetId?: string): CellStyle[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM cell_styles WHERE workbook_id = ?';
    const params: (string | number)[] = [workbookId];
    
    if (sheetId) {
      sql += ' AND sheet_id = ?';
      params.push(sheetId);
    }
    
    sql += ' ORDER BY cell_id';
    
    const results = db.exec(sql, params);
    if (results.length === 0) return [];
    
    return results[0].values.map(row => rowToCellStyle({
      id: row[0] as string,
      workbook_id: row[1] as number,
      sheet_id: row[2] as string,
      cell_id: row[3] as string,
      font_color: row[4] as string | null,
      bg_color: row[5] as string | null,
      bold: row[6] as number,
      italic: row[7] as number,
      align: row[8] as string | null,
      number_format: row[9] as string | null
    }));
  }

  static findById(workbookId: number, sheetId: string, cellId: string): CellStyle | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      SELECT * FROM cell_styles 
      WHERE workbook_id = ? AND sheet_id = ? AND cell_id = ?
    `);
    stmt.bind([workbookId, sheetId, cellId]);
    
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    
    const row = stmt.getAsObject() as unknown as CellStyleRow;
    stmt.free();
    
    return rowToCellStyle(row);
  }

  static create(style: Omit<CellStyle, 'id'>): CellStyle {
    const db = getDatabase();
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO cell_styles 
      (id, workbook_id, sheet_id, cell_id, font_color, bg_color, bold, italic, align, number_format)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      id,
      style.workbookId,
      style.sheetId,
      style.cellId,
      style.fontColor || null,
      style.bgColor || null,
      style.bold ? 1 : 0,
      style.italic ? 1 : 0,
      style.align || null,
      style.numberFormat || null
    ]);
    
    saveDatabase();
    
    const created = this.findById(style.workbookId, style.sheetId, style.cellId);
    if (!created) throw new Error('Failed to create cell style');
    return created;
  }

  static update(workbookId: number, sheetId: string, cellId: string, updates: Partial<CellStyle>): CellStyle | null {
    const db = getDatabase();
    const existing = this.findById(workbookId, sheetId, cellId);
    
    if (!existing) {
      return this.create({
        workbookId,
        sheetId,
        cellId,
        ...updates
      } as Omit<CellStyle, 'id'>);
    }
    
    const merged = { ...existing, ...updates };
    
    const stmt = db.prepare(`
      UPDATE cell_styles 
      SET font_color = ?, bg_color = ?, bold = ?, italic = ?, align = ?, number_format = ?
      WHERE workbook_id = ? AND sheet_id = ? AND cell_id = ?
    `);
    
    stmt.run([
      merged.fontColor || null,
      merged.bgColor || null,
      merged.bold ? 1 : 0,
      merged.italic ? 1 : 0,
      merged.align || null,
      merged.numberFormat || null,
      workbookId,
      sheetId,
      cellId
    ]);
    
    saveDatabase();
    
    return this.findById(workbookId, sheetId, cellId);
  }

  static delete(workbookId: number, sheetId: string, cellId: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare(`
      DELETE FROM cell_styles 
      WHERE workbook_id = ? AND sheet_id = ? AND cell_id = ?
    `);
    stmt.run([workbookId, sheetId, cellId]);
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    saveDatabase();
    return changes > 0;
  }

  static deleteBySheet(workbookId: number, sheetId: string): void {
    const db = getDatabase();
    db.run(`
      DELETE FROM cell_styles 
      WHERE workbook_id = ? AND sheet_id = ?
    `, [workbookId, sheetId]);
    saveDatabase();
  }
}
