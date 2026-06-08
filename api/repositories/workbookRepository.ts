import { getDatabase, saveDatabase } from '../db/init';
import type { Workbook, WorkbookListItem, Sheet } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface WorkbookRow {
  id: number;
  name: string;
  sheets: string;
  active_sheet_id: string;
  version: number;
  created_at: string;
  updated_at: string;
}

function createDefaultSheet(index: number): Sheet {
  return {
    id: `sheet${index + 1}`,
    name: `Sheet${index + 1}`,
    index,
    cells: {},
    isHidden: false
  };
}

function createDefaultSheets(): Sheet[] {
  return [createDefaultSheet(0)];
}

export class WorkbookRepository {
  static findAll(): WorkbookListItem[] {
    const db = getDatabase();
    const results = db.exec(`
      SELECT w.id, w.name, w.updated_at, 
             (SELECT COUNT(*) FROM json_each(w.sheets) WHERE json_extract(value, '$.isHidden') = 0) as sheet_count
      FROM workbooks w 
      ORDER BY w.updated_at DESC
    `);
    if (results.length === 0) return [];
    
    const rows = results[0].values;
    return rows.map(row => ({
      id: row[0] as number,
      name: row[1] as string,
      updatedAt: row[2] as string,
      sheetCount: row[3] as number
    }));
  }

  static findById(id: number): Workbook | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM workbooks WHERE id = $id');
    stmt.bind({ $id: id });
    
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    
    const row = stmt.getAsObject() as unknown as WorkbookRow;
    stmt.free();
    
    let sheets: Sheet[];
    try {
      sheets = JSON.parse(row.sheets);
    } catch {
      sheets = createDefaultSheets();
    }

    return {
      id: row.id,
      name: row.name,
      sheets,
      activeSheetId: row.active_sheet_id,
      version: row.version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  static create(workbook: Omit<Workbook, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Workbook {
    const db = getDatabase();
    const sheets = workbook.sheets.length > 0 ? workbook.sheets : createDefaultSheets();
    const activeSheetId = workbook.activeSheetId || sheets[0].id;
    
    const stmt = db.prepare('INSERT INTO workbooks (name, sheets, active_sheet_id, version) VALUES (?, ?, ?, 0)');
    stmt.run([workbook.name, JSON.stringify(sheets), activeSheetId]);
    
    const id = db.exec('SELECT last_insert_rowid() as id')[0].values[0][0] as number;
    saveDatabase();
    
    const created = this.findById(id);
    if (!created) throw new Error('Failed to create workbook');
    return created;
  }

  static update(id: number, workbook: Omit<Workbook, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Workbook | null {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE workbooks 
      SET name = ?, sheets = ?, active_sheet_id = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run([workbook.name, JSON.stringify(workbook.sheets), workbook.activeSheetId, id]);
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    if (changes === 0) return null;
    
    saveDatabase();
    return this.findById(id);
  }

  static updateVersion(id: number, version: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare(`
      UPDATE workbooks 
      SET version = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    stmt.run([version, id]);
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    saveDatabase();
    return changes > 0;
  }

  static delete(id: number): boolean {
    const db = getDatabase();
    const stmt = db.prepare('DELETE FROM workbooks WHERE id = ?');
    stmt.run([id]);
    
    const changes = db.exec('SELECT changes() as c')[0].values[0][0] as number;
    if (changes === 0) return false;
    
    saveDatabase();
    return true;
  }

  static getVersion(id: number): number {
    const db = getDatabase();
    const stmt = db.prepare('SELECT version FROM workbooks WHERE id = ?');
    stmt.bind([id]);
    
    if (!stmt.step()) {
      stmt.free();
      return 0;
    }
    
    const version = stmt.getAsObject() as { version: number };
    stmt.free();
    return version.version;
  }
}

export class SheetRepository {
  static findAll(workbookId: number): Sheet[] | null {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return null;
    return workbook.sheets.sort((a, b) => a.index - b.index);
  }

  static findById(workbookId: number, sheetId: string): Sheet | null {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return null;
    return workbook.sheets.find(s => s.id === sheetId) || null;
  }

  static create(workbookId: number, name?: string): Sheet | null {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return null;

    const maxIndex = workbook.sheets.reduce((max, s) => Math.max(max, s.index), -1);
    const newIndex = maxIndex + 1;
    const sheetName = name || `Sheet${workbook.sheets.length + 1}`;
    
    const newSheet: Sheet = {
      id: uuidv4(),
      name: sheetName,
      index: newIndex,
      cells: {},
      isHidden: false
    };

    workbook.sheets.push(newSheet);
    WorkbookRepository.update(workbookId, {
      name: workbook.name,
      sheets: workbook.sheets,
      activeSheetId: workbook.activeSheetId
    });

    return newSheet;
  }

  static update(workbookId: number, sheetId: string, updates: Partial<Omit<Sheet, 'id'>>): Sheet | null {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return null;

    const sheetIndex = workbook.sheets.findIndex(s => s.id === sheetId);
    if (sheetIndex === -1) return null;

    workbook.sheets[sheetIndex] = {
      ...workbook.sheets[sheetIndex],
      ...updates
    };

    WorkbookRepository.update(workbookId, {
      name: workbook.name,
      sheets: workbook.sheets,
      activeSheetId: workbook.activeSheetId
    });

    return workbook.sheets[sheetIndex];
  }

  static delete(workbookId: number, sheetId: string): boolean {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook || workbook.sheets.length <= 1) return false;

    const sheetIndex = workbook.sheets.findIndex(s => s.id === sheetId);
    if (sheetIndex === -1) return false;

    workbook.sheets = workbook.sheets.filter(s => s.id !== sheetId);
    
    let activeSheetId = workbook.activeSheetId;
    if (activeSheetId === sheetId) {
      activeSheetId = workbook.sheets[0]?.id || '';
    }

    WorkbookRepository.update(workbookId, {
      name: workbook.name,
      sheets: workbook.sheets,
      activeSheetId
    });

    return true;
  }

  static reorder(workbookId: number, sheetId: string, newIndex: number): Sheet[] | null {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return null;

    const sheet = workbook.sheets.find(s => s.id === sheetId);
    if (!sheet) return null;

    workbook.sheets = workbook.sheets.filter(s => s.id !== sheetId);
    sheet.index = newIndex;
    
    workbook.sheets.splice(newIndex, 0, sheet);
    workbook.sheets.forEach((s, i) => {
      s.index = i;
    });

    WorkbookRepository.update(workbookId, {
      name: workbook.name,
      sheets: workbook.sheets,
      activeSheetId: workbook.activeSheetId
    });

    return workbook.sheets.sort((a, b) => a.index - b.index);
  }

  static copy(workbookId: number, sheetId: string): Sheet | null {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return null;

    const sourceSheet = workbook.sheets.find(s => s.id === sheetId);
    if (!sourceSheet) return null;

    const maxIndex = workbook.sheets.reduce((max, s) => Math.max(max, s.index), -1);
    const newSheet: Sheet = {
      id: uuidv4(),
      name: `${sourceSheet.name} Copy`,
      index: maxIndex + 1,
      cells: JSON.parse(JSON.stringify(sourceSheet.cells)),
      isHidden: false,
      tabColor: sourceSheet.tabColor
    };

    workbook.sheets.push(newSheet);
    WorkbookRepository.update(workbookId, {
      name: workbook.name,
      sheets: workbook.sheets,
      activeSheetId: workbook.activeSheetId
    });

    return newSheet;
  }

  static markRefsAsError(workbookId: number, deletedSheetId: string): void {
    const workbook = WorkbookRepository.findById(workbookId);
    if (!workbook) return;

    const refPattern = new RegExp(`['"]?${deletedSheetId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]?!`, 'i');

    for (const sheet of workbook.sheets) {
      for (const [cellId, cell] of Object.entries(sheet.cells)) {
        if (cell.formula && refPattern.test(cell.formula)) {
          sheet.cells[cellId] = {
            ...cell,
            isError: true,
            errorMessage: '#REF!',
            value: '#REF!'
          };
        }
      }
    }

    WorkbookRepository.update(workbookId, {
      name: workbook.name,
      sheets: workbook.sheets,
      activeSheetId: workbook.activeSheetId
    });
  }
}
