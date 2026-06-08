import { getDatabase, saveDatabase } from '../db/init';
import type { ConditionalFormat } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface ConditionalFormatRow {
  id: string;
  workbook_id: number;
  sheet_id: string;
  range_ref: string;
  rule: string;
  style: string;
  priority: number;
}

function rowToConditionalFormat(row: ConditionalFormatRow): ConditionalFormat {
  return {
    id: row.id,
    workbookId: row.workbook_id,
    sheetId: row.sheet_id,
    rangeRef: row.range_ref,
    rule: JSON.parse(row.rule),
    style: JSON.parse(row.style),
    priority: row.priority
  };
}

export class ConditionalFormatRepository {
  static findAll(workbookId: number, sheetId?: string): ConditionalFormat[] {
    const db = getDatabase();
    let sql = 'SELECT * FROM conditional_formats WHERE workbook_id = ?';
    const params: (string | number)[] = [workbookId];
    
    if (sheetId) {
      sql += ' AND sheet_id = ?';
      params.push(sheetId);
    }
    
    sql += ' ORDER BY priority ASC';
    
    const results = db.exec(sql, params);
    if (results.length === 0) return [];
    
    return results[0].values.map(row => rowToConditionalFormat({
      id: row[0] as string,
      workbook_id: row[1] as number,
      sheet_id: row[2] as string,
      range_ref: row[3] as string,
      rule: row[4] as string,
      style: row[5] as string,
      priority: row[6] as number
    }));
  }

  static findById(id: string): ConditionalFormat | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM conditional_formats WHERE id = ?');
    stmt.bind([id]);
    
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    
    const row = stmt.getAsObject() as unknown as ConditionalFormatRow;
    stmt.free();
    
    return rowToConditionalFormat(row);
  }

  static create(format: Omit<ConditionalFormat, 'id'>): ConditionalFormat {
    const db = getDatabase();
    const id = uuidv4();
    
    const stmt = db.prepare(`
      INSERT INTO conditional_formats 
      (id, workbook_id, sheet_id, range_ref, rule, style, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      id,
      format.workbookId,
      format.sheetId,
      format.rangeRef,
      JSON.stringify(format.rule),
      JSON.stringify(format.style),
      format.priority
    ]);
    
    saveDatabase();
    
    const created = this.findById(id);
    if (!created) throw new Error('Failed to create conditional format');
    return created;
  }

  static update(id: string, updates: Partial<ConditionalFormat>): ConditionalFormat | null {
    const db = getDatabase();
    const existing = this.findById(id);
    if (!existing) return null;
    
    const merged = { ...existing, ...updates };
    
    const stmt = db.prepare(`
      UPDATE conditional_formats 
      SET range_ref = ?, rule = ?, style = ?, priority = ?
      WHERE id = ?
    `);
    
    stmt.run([
      merged.rangeRef,
      JSON.stringify(merged.rule),
      JSON.stringify(merged.style),
      merged.priority,
      id
    ]);
    
    saveDatabase();
    
    return this.findById(id);
  }

  static delete(id: string): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM conditional_formats WHERE id = ?');
    stmt.run([id]);
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    saveDatabase();
    return changes > 0;
  }

  static deleteBySheet(workbookId: number, sheetId: string): void {
    const db = getDatabase();
    db.run(`
      DELETE FROM conditional_formats 
      WHERE workbook_id = ? AND sheet_id = ?
    `, [workbookId, sheetId]);
    saveDatabase();
  }
}
