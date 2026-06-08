import { Request, Response } from 'express';
import { WorkbookService } from '../services/workbookService';
import type { ApiResponse } from '../../shared/types';

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

      const workbook = WorkbookService.getWorkbook(id);
      if (!workbook) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      res.json({ data: workbook });
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }

  static async create(req: Request, res: Response<ApiResponse<any>>) {
    try {
      const { name, cells } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid workbook name' });
      }

      if (!cells || typeof cells !== 'object') {
        return res.status(400).json({ error: 'Invalid cells data' });
      }

      const workbook = WorkbookService.createWorkbook(name, cells);
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

      const { name, cells } = req.body;
      
      if (!name || typeof name !== 'string') {
        return res.status(400).json({ error: 'Invalid workbook name' });
      }

      if (!cells || typeof cells !== 'object') {
        return res.status(400).json({ error: 'Invalid cells data' });
      }

      const workbook = WorkbookService.updateWorkbook(id, name, cells);
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

  static async exportCSV(req: Request, res: Response) {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid workbook ID' });
      }

      const workbook = WorkbookService.getWorkbook(id);
      if (!workbook) {
        return res.status(404).json({ error: 'Workbook not found' });
      }

      const csv = WorkbookService.exportToCSV(workbook);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${workbook.name}.csv"`);
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
}
