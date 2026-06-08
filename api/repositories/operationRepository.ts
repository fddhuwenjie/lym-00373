import { getDatabase, saveDatabase } from '../db/init';
import type { Operation } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

interface OperationRow {
  id: string;
  workbook_id: number;
  type: string;
  timestamp: string;
  lamport_time: number;
  user_id: string;
  user_name: string;
  sheet_id: string;
  payload: string;
  reverse_payload: string | null;
  version: number;
}

function rowToOperation(row: OperationRow): Operation {
  return {
    id: row.id,
    type: row.type as Operation['type'],
    timestamp: new Date(row.timestamp).getTime(),
    lamportTime: row.lamport_time,
    userId: row.user_id,
    userName: row.user_name,
    sheetId: row.sheet_id,
    payload: JSON.parse(row.payload),
    reversePayload: row.reverse_payload ? JSON.parse(row.reverse_payload) : undefined
  };
}

export class OperationRepository {
  static findAll(workbookId: number, limit: number = 100): Operation[] {
    const db = getDatabase();
    const results = db.exec(`
      SELECT * FROM operations 
      WHERE workbook_id = ? 
      ORDER BY lamport_time DESC, timestamp DESC 
      LIMIT ?
    `, [workbookId, limit]);
    
    if (results.length === 0) return [];
    
    return results[0].values.map(row => rowToOperation({
      id: row[0] as string,
      workbook_id: row[1] as number,
      type: row[2] as string,
      timestamp: row[3] as string,
      lamport_time: row[4] as number,
      user_id: row[5] as string,
      user_name: row[6] as string,
      sheet_id: row[7] as string,
      payload: row[8] as string,
      reverse_payload: row[9] as string | null,
      version: row[10] as number
    }));
  }

  static findSinceVersion(workbookId: number, version: number): Operation[] {
    const db = getDatabase();
    const results = db.exec(`
      SELECT * FROM operations 
      WHERE workbook_id = ? AND version > ?
      ORDER BY lamport_time ASC, timestamp ASC
    `, [workbookId, version]);
    
    if (results.length === 0) return [];
    
    return results[0].values.map(row => rowToOperation({
      id: row[0] as string,
      workbook_id: row[1] as number,
      type: row[2] as string,
      timestamp: row[3] as string,
      lamport_time: row[4] as number,
      user_id: row[5] as string,
      user_name: row[6] as string,
      sheet_id: row[7] as string,
      payload: row[8] as string,
      reverse_payload: row[9] as string | null,
      version: row[10] as number
    }));
  }

  static findById(id: string): Operation | null {
    const db = getDatabase();
    const stmt = db.prepare('SELECT * FROM operations WHERE id = ?');
    stmt.bind([id]);
    
    if (!stmt.step()) {
      stmt.free();
      return null;
    }
    
    const row = stmt.getAsObject() as unknown as OperationRow;
    stmt.free();
    
    return rowToOperation(row);
  }

  static create(operation: Operation & { workbookId: number; version: number }): Operation {
    const db = getDatabase();
    
    const opId = operation.id || uuidv4();
    
    const timestamp = operation.timestamp && !isNaN(operation.timestamp) && operation.timestamp > 0
      ? operation.timestamp
      : Date.now();
    
    const lamportTime = operation.lamportTime && !isNaN(operation.lamportTime) && operation.lamportTime > 0
      ? operation.lamportTime
      : this.getMaxLamportTime(operation.workbookId) + 1;
    
    const sheetId = operation.sheetId || '';
    
    const stmt = db.prepare(`
      INSERT INTO operations 
      (id, workbook_id, type, timestamp, lamport_time, user_id, user_name, sheet_id, payload, reverse_payload, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run([
      opId,
      operation.workbookId,
      operation.type,
      new Date(timestamp).toISOString(),
      lamportTime,
      operation.userId || '',
      operation.userName || '',
      sheetId,
      JSON.stringify(operation.payload || {}),
      operation.reversePayload ? JSON.stringify(operation.reversePayload) : null,
      operation.version
    ]);
    
    saveDatabase();
    
    const created = this.findById(opId);
    if (!created) throw new Error('Failed to create operation');
    return created;
  }

  static getMaxLamportTime(workbookId: number): number {
    const db = getDatabase();
    const results = db.exec(`
      SELECT COALESCE(MAX(lamport_time), 0) as max_time 
      FROM operations 
      WHERE workbook_id = ?
    `, [workbookId]);
    
    if (results.length === 0 || results[0].values.length === 0) return 0;
    return results[0].values[0][0] as number;
  }

  static deleteByWorkbook(workbookId: number): void {
    const db = getDatabase();
    db.run('DELETE FROM operations WHERE workbook_id = ?', [workbookId]);
    saveDatabase();
  }
}
