import { Request, Response } from 'express';
import { WorkbookService } from '../services/workbookService';
import type { ApiResponse, Sheet, CellStyle, ConditionalFormat, Chart, Operation } from '../../shared/types';
import { v4 as uuidv4 } from 'uuid';

export class WorkbookController {
  static async list(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbooks = WorkbookService.getAllWorkbooks();
      res.json({ data: workbooks });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async get(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const full = req.query.full === 'true';
      
      if (full) {
        const data = WorkbookService.getWorkbookFull(id);
        if (!data) {
          return res.status(404).json({ error: 'Workbook not found' });
        }
        res.json({ data });
      } else {
        const workbook = WorkbookService.getWorkbook(id);
        if (!workbook) {
          return res.status(404).json({ error: 'Workbook not found' });
        }
        res.json({ data: workbook });
      }
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async create(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const { name } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid workbook name' });
      }

      const workbook = WorkbookService.createWorkbook(name);
      res.status(201).json({ data: workbook });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async update(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const { name, sheets, activeSheetId } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid workbook name' });
      }

      if (!sheets || !Array.isArray(sheets)) {
        return res.status(400).json({ error: 'Invalid sheets data' });
      }

      if (!activeSheetId || typeof activeSheetId !== 'string') {
        return res.status(400).json({ error: 'Invalid active sheet ID' });
      }

      const workbook = WorkbookService.updateWorkbook(id, name, sheets, activeSheetId);
      if (!workbook) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      res.json({ data: workbook });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async remove(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const deleted = WorkbookService.deleteWorkbook(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async exportWorkbook(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const format = (req.query.format as string) || 'csv';
      const sheetId = req.query.sheetId as string;

      const workbook = WorkbookService.getWorkbook(id);
      if (!workbook) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      if (format === 'xlsx') {
        const full = WorkbookService.getWorkbookFull(id);
        if (!full) {
          return res.status(404).json({ error: 'Workbook not found' });
        }
        
        const buffer = WorkbookService.exportToXLSX(workbook, full.styles, full.conditionalFormats);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${workbook.name}.xlsx"`);
        return res.send(buffer);
      }

      const csv = WorkbookService.exportToCSV(workbook, sheetId);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${workbook.name}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async importWorkbook(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const format = (req.query.format as string) || 'xlsx';
      
      if (!req.body || !Buffer.isBuffer(req.body)) {
        return res.status(400).json({ error: 'Invalid file data' });
      }

      if (format === 'xlsx') {
        const result = WorkbookService.importFromXLSX(id, req.body);
        if (!result) {
          return res.status(404).json({ error: 'Workbook not found' });
        }
        return res.json({ data: result });
      }

      return res.status(400).json({ error: 'Unsupported format' });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async listSheets(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const sheets = WorkbookService.getSheets(workbookId);
      if (sheets === null) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      res.json({ data: sheets });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async createSheet(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const { name } = req.body;
      if (name !== undefined && typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid sheet name' });
      }

      const sheet = WorkbookService.createSheet(workbookId, name);
      if (sheet === null) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      res.status(201).json({ data: sheet });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateSheet(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.params.sheetId;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const updates = req.body as Partial<Omit<Sheet, 'id'>>;
      const sheet = WorkbookService.updateSheet(workbookId, sheetId, updates);
      
      if (sheet === null) {
        return res.status(404).json({ error: 'Sheet not found' });
      }

      res.json({ data: sheet });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteSheet(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.params.sheetId;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const deleted = WorkbookService.deleteSheet(workbookId, sheetId);
      if (!deleted) {
        return res.status(404).json({ error: 'Sheet not found or cannot delete last sheet' });
      }

      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async reorderSheet(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.params.sheetId;
      const { newIndex } = req.body;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      if (newIndex === undefined || typeof newIndex !== 'number') {
        return res.status(400).json({ error: 'Invalid new index' });
      }

      const sheets = WorkbookService.reorderSheet(workbookId, sheetId, newIndex);
      if (sheets === null) {
        return res.status(404).json({ error: 'Sheet not found' });
      }

      res.json({ data: sheets });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async copySheet(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.params.sheetId;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const sheet = WorkbookService.copySheet(workbookId, sheetId);
      if (sheet === null) {
        return res.status(404).json({ error: 'Sheet not found' });
      }

      res.status(201).json({ data: sheet });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async listCellStyles(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.query.sheetId as string;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const styles = WorkbookService.getCellStyles(workbookId, sheetId);
      res.json({ data: styles });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateCellStyle(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.params.sheetId;
      const cellId = req.params.cellId;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const updates = req.body as Partial<CellStyle>;
      const style = WorkbookService.updateCellStyle(workbookId, sheetId, cellId, updates);
      
      if (style === null) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      res.json({ data: style });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteCellStyle(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.params.sheetId;
      const cellId = req.params.cellId;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const deleted = WorkbookService.deleteCellStyle(workbookId, sheetId, cellId);
      if (!deleted) {
        return res.status(404).json({ error: 'Cell style not found' });
      }

      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async listConditionalFormats(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.query.sheetId as string;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const formats = WorkbookService.getConditionalFormats(workbookId, sheetId);
      res.json({ data: formats });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async createConditionalFormat(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const format = req.body as Omit<ConditionalFormat, 'id'>;
      format.workbookId = workbookId;
      
      const created = WorkbookService.createConditionalFormat(format);
      res.status(201).json({ data: created });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateConditionalFormat(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = req.params.id;
      const updates = req.body as Partial<ConditionalFormat>;
      
      const updated = WorkbookService.updateConditionalFormat(id, updates);
      if (updated === null) {
        return res.status(404).json({ error: 'Conditional format not found' });
      }

      res.json({ data: updated });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteConditionalFormat(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = req.params.id;
      
      const deleted = WorkbookService.deleteConditionalFormat(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Conditional format not found' });
      }

      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async listCharts(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const sheetId = req.query.sheetId as string;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const charts = WorkbookService.getCharts(workbookId, sheetId);
      res.json({ data: charts });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async createChart(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const chart = req.body as Omit<Chart, 'id'>;
      chart.workbookId = workbookId;
      
      const created = WorkbookService.createChart(chart);
      res.status(201).json({ data: created });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async updateChart(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = req.params.id;
      const updates = req.body as Partial<Chart>;
      
      const updated = WorkbookService.updateChart(id, updates);
      if (updated === null) {
        return res.status(404).json({ error: 'Chart not found' });
      }

      res.json({ data: updated });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async deleteChart(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const id = req.params.id;
      
      const deleted = WorkbookService.deleteChart(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Chart not found' });
      }

      res.json({ data: { success: true } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async listOperations(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const sinceVersion = req.query.sinceVersion ? parseInt(req.query.sinceVersion as string) : undefined;
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      let operations: Operation[];
      if (sinceVersion !== undefined) {
        operations = WorkbookService.getOperationsSince(workbookId, sinceVersion);
      } else {
        operations = WorkbookService.getOperations(workbookId, limit);
      }

      res.json({ data: operations });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async createOperation(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const operation = req.body as Operation & { workbookId: number; version: number };
      operation.id = operation.id || uuidv4();
      operation.workbookId = workbookId;
      operation.version = operation.version || WorkbookService.getVersion(workbookId) + 1;
      operation.lamportTime = Math.max(
        operation.lamportTime,
        WorkbookService.getMaxLamportTime(workbookId) + 1
      );
      
      const created = WorkbookService.createOperation(operation);
      WorkbookService.updateVersion(workbookId, operation.version);
      
      res.status(201).json({ data: created });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async getVersion(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const workbookId = parseInt(req.params.workbookId);
      
      if (isNaN(workbookId)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const version = WorkbookService.getVersion(workbookId);
      res.json({ data: { version } });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
