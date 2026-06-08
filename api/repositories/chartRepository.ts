import { getDatabase, saveDatabase } from '../db/init';
import type { Chart } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface ChartRow {
  id: string;
  workbook_id: number;
  sheet_id: string;
  range_ref: string;
  type: string;
  options: string;
}

function rowToChart(row: ChartRow): Chart {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    rangeRef: row.range_ref,
    type: row.type as Chart['type'],
    options: JSON.parse(row.options)
  };
}

export class ChartRepository {
  static findAll(workbookId: number, sheetId?: string): Chart[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM charts WHERE workbook_id = ?';
    const params: (string | number)[] = [workbookId];
    
    if (sheetId) {
      sql += ' AND sheet_id = ?';
      params.push(sheetId);
    }
    
    const results = db.exec(sql, params);
    if (results.length === 0) return [];
    
    return results[0].values.map(row => rowToChart({
      id: row[0] as string,
      workbook_id: row[1] as number,
      sheet_id: row[2] as string,
      range_ref: row[3] as string,
      type: row[4] as string,
      options: row[5] as string
    }));
  }

  static findById(id: string): Chart | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM charts WHERE id = ?');
    stmt.bind([id]);
    
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    
    const row = stmt.getAsObject() as unknown as ChartRow;
    stmt.free();
    
    return rowToChart(row);
  }

  static create(chart: Omit<Chart, 'id'>): Chart {
    const db = getDatabase();
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO charts 
      (id, workbook_id, sheet_id, range_ref, type, options)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      id,
      chart.workbookId,
      chart.sheetId,
      chart.rangeRef,
      chart.type,
      JSON.stringify(chart.options)
    ]);
    
    saveDatabase();
    
    const created = this.findById(id);
    if (!created) throw new Error('Failed to create chart');
    return created;
  }

  static update(id: string, updates: Partial<Chart>): Chart | null {
    const db = getDatabase();
    const existing = this.findById(id);
    if (!existing) return null;
    
    const merged = { ...existing, ...updates };
    
    const stmt = db.prepare(`
      UPDATE charts 
      SET range_ref = ?, type = ?, options = ?
      WHERE id = ?
    `);
    
    stmt.run([
      merged.rangeRef,
      merged.type,
      JSON.stringify(merged.options),
      id
    ]);
    
    saveDatabase();
    
    return this.findById(id);
  }

  static delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM charts WHERE id = ?');
    stmt.run([id]);
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    saveDatabase();
    return changes > 0;
  }

  static deleteBySheet(workbookId: number, sheetId: string): void {
    const db = getDatabase();
    db.run(`
      DELETE FROM charts 
      WHERE workbook_id = ? AND sheet_id = ?
    `, [workbookId, sheetId]);
    saveDatabase();
  }
}
