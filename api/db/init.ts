import initSqlJs, { Database } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../data/spreadsheet.db');

let db: Database | null = null;

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const SQL = await initSqlJs();
  
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS workbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL DEFAULT 'Untitled',
      sheets TEXT NOT NULL DEFAULT '[]',
      active_sheet_id TEXT NOT NULL DEFAULT 'sheet1',
      version INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cell_styles (
      id TEXT PRIMARY KEY,
      workbook_id INTEGER NOT NULL,
      sheet_id TEXT NOT NULL,
      cell_id TEXT NOT NULL,
      font_color TEXT,
      bg_color TEXT,
      bold INTEGER DEFAULT 0,
      italic INTEGER DEFAULT 0,
      align TEXT,
      number_format TEXT,
      FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS conditional_formats (
      id TEXT PRIMARY KEY,
      workbook_id INTEGER NOT NULL,
      sheet_id TEXT NOT NULL,
      range_ref TEXT NOT NULL,
      rule TEXT NOT NULL,
      style TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS charts (
      id TEXT PRIMARY KEY,
      workbook_id INTEGER NOT NULL,
      sheet_id TEXT NOT NULL,
      range_ref TEXT NOT NULL,
      type TEXT NOT NULL,
      options TEXT NOT NULL,
      FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS operations (
      id TEXT PRIMARY KEY,
      workbook_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      timestamp DATETIME NOT NULL,
      lamport_time INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      sheet_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      reverse_payload TEXT,
      version INTEGER NOT NULL,
      FOREIGN KEY (workbook_id) REFERENCES workbooks(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_workbooks_updated_at 
    ON workbooks(updated_at DESC)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_cell_styles_workbook 
    ON cell_styles(workbook_id, sheet_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_conditional_formats_workbook 
    ON conditional_formats(workbook_id, sheet_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_charts_workbook 
    ON charts(workbook_id, sheet_id)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_operations_workbook 
    ON operations(workbook_id, version DESC)
  `);

  migrateExistingWorkbooks(db);

  saveDatabase();

  return db;
}

function migrateExistingWorkbooks(db: Database): void {
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='workbooks'");
  if (result.length === 0) return;

  const columns = db.exec("PRAGMA table_info(workbooks)");
  const columnNames = columns[0].values.map(col => col[1] as string);

  const requiredColumns = ['sheets', 'active_sheet_id', 'version'];
  const missingColumns = requiredColumns.filter(col => !columnNames.includes(col));
  
  if (missingColumns.length > 0) {
    for (const col of missingColumns) {
      if (col === 'sheets') {
        db.run(`ALTER TABLE workbooks ADD COLUMN sheets TEXT NOT NULL DEFAULT '[]'`);
      } else if (col === 'active_sheet_id') {
        db.run(`ALTER TABLE workbooks ADD COLUMN active_sheet_id TEXT NOT NULL DEFAULT 'sheet1'`);
      } else if (col === 'version') {
        db.run(`ALTER TABLE workbooks ADD COLUMN version INTEGER NOT NULL DEFAULT 0`);
      }
    }
  }

  if (columnNames.includes('cells')) {
    const rows = db.exec('SELECT id, name, cells FROM workbooks');
    if (rows.length > 0) {
      const values = rows[0].values;
      for (const row of values) {
        const id = row[0] as number;
        const name = row[1] as string;
        const cellsJson = row[2] as string;
        
        let cells: Record<string, unknown> = {};
        try {
          cells = JSON.parse(cellsJson);
        } catch {
          cells = {};
        }

        const sheetId = 'sheet1';
        const sheets = [{
          id: sheetId,
          name: 'Sheet1',
          index: 0,
          cells,
          isHidden: false
        }];

        const stmt = db.prepare(`
          UPDATE workbooks 
          SET sheets = ?, active_sheet_id = ?, version = COALESCE(version, 0)
          WHERE id = ?
        `);
        stmt.run([JSON.stringify(sheets), sheetId, id]);
        stmt.free();
      }
    }

    db.run('CREATE TABLE workbooks_new AS SELECT id, name, sheets, active_sheet_id, version, created_at, updated_at FROM workbooks');
    db.run('DROP TABLE workbooks');
    db.run('ALTER TABLE workbooks_new RENAME TO workbooks');
  } else {
    const rows = db.exec('SELECT id, sheets FROM workbooks WHERE sheets IS NULL OR sheets = \'\'');
    if (rows.length > 0) {
      for (const row of rows[0].values) {
        const id = row[0] as number;
        const sheetId = 'sheet1';
        const sheets = [{
          id: sheetId,
          name: 'Sheet1',
          index: 0,
          cells: {},
          isHidden: false
        }];
        
        db.run(`
          UPDATE workbooks 
          SET sheets = ?, active_sheet_id = ?, version = COALESCE(version, 0)
          WHERE id = ?
        `, [JSON.stringify(sheets), sheetId, id]);
      }
    }
  }

  const columnsAfter = db.exec("PRAGMA table_info(workbooks)");
  const columnNamesAfter = columnsAfter[0].values.map(col => col[1] as string);
  
  if (columnNamesAfter.includes('version')) {
    db.run(`UPDATE workbooks SET version = COALESCE(version, 0) WHERE version IS NULL`);
  }
  if (columnNamesAfter.includes('active_sheet_id')) {
    db.run(`UPDATE workbooks SET active_sheet_id = COALESCE(active_sheet_id, 'sheet1') WHERE active_sheet_id IS NULL OR active_sheet_id = ''`);
  }
  if (columnNamesAfter.includes('sheets')) {
    db.run(`UPDATE workbooks SET sheets = '[]' WHERE sheets IS NULL OR sheets = ''`);
  }
}

export function saveDatabase(): void {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

export function getDatabase(): Database {
  if (!db) {
    throw new Error('Database not initialized');
  }
  return db;
}
