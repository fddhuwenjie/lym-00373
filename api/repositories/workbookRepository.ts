import { getDatabase, saveDatabase } from '../db/init';
import type { Workbook, WorkbookListItem } from '../../shared/types';

interface WorkbookRow {
  id: number;
  name: string;
  cells: string;
  created_at: string;
  updated_at: string;
}

export class WorkbookRepository {
  static findAll(): WorkbookListItem[] {
    const db = getDatabase();
    const results = db.exec('SELECT id, name, updated_at FROM workbooks ORDER BY updated_at DESC');
    if (results.length === 0) return [];
    
    const rows = results[0].values;
    return rows.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      updatedAt: row[2] as string
    }));
  }

  static findById(id: number): Workbook | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM workbooks WHERE id = ?');
    stmt.bind([id]);
    
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    
    const row = stmt.getAsObject() as unknown as WorkbookRow;
    stmt.free();
    
    return {
      id: row.id,
      name: row.name,
      cells: JSON.parse(row.cells),
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static create(workbook: Omit<Workbook, 'id' | 'createdAt' | 'updatedAt'>): Workbook {
    const db = getDatabase();
    const stmt = db.prepare('INSERT INTO workbooks (name, cells) VALUES (?, ?)');
    stmt.run([workbook.name, JSON.stringify(workbook.cells)]);
    saveDatabase();
    
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    const created = this.findById(id);
    if (!created) throw new Error('Failed to create workbook');
    return created;
  }

  static update(id: number, workbook: Omit<Workbook, 'id' | 'createdAt' | 'updatedAt'>): Workbook | null {
    const db = getDatabase();
    const stmt = db.prepare('UPDATE workbooks SET name = ?, cells = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run([workbook.name, JSON.stringify(workbook.cells), id]);
    saveDatabase();
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    if (changes === 0) return null;
    return this.findById(id);
  }

  static delete(id: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM workbooks WHERE id = ?');
    stmt.run([id]);
    saveDatabase();
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    return changes > 0;
  }
}
