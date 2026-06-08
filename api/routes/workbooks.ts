import { Router } from 'express';
import { WorkbookController } from '../controllers/workbookController';

const router = Router();

router.get('/', WorkbookController.list);
router.get('/:id', WorkbookController.get);
router.post('/', WorkbookController.create);
router.put('/:id', WorkbookController.update);
router.delete('/:id', WorkbookController.remove);
router.get('/:id/export', WorkbookController.exportWorkbook);
router.post('/:id/import', WorkbookController.importWorkbook);

router.get('/:workbookId/sheets', WorkbookController.listSheets);
router.post('/:workbookId/sheets', WorkbookController.createSheet);
router.put('/:workbookId/sheets/:sheetId', WorkbookController.updateSheet);
router.delete('/:workbookId/sheets/:sheetId', WorkbookController.deleteSheet);
router.post('/:workbookId/sheets/:sheetId/reorder', WorkbookController.reorderSheet);
router.post('/:workbookId/sheets/:sheetId/copy', WorkbookController.copySheet);

router.get('/:workbookId/styles', WorkbookController.listCellStyles);
router.put('/:workbookId/styles/:sheetId/:cellId', WorkbookController.updateCellStyle);
router.delete('/:workbookId/styles/:sheetId/:cellId', WorkbookController.deleteCellStyle);

router.get('/:workbookId/conditional-formats', WorkbookController.listConditionalFormats);
router.post('/:workbookId/conditional-formats', WorkbookController.createConditionalFormat);
router.put('/conditional-formats/:id', WorkbookController.updateConditionalFormat);
router.delete('/conditional-formats/:id', WorkbookController.deleteConditionalFormat);

router.get('/:workbookId/charts', WorkbookController.listCharts);
router.post('/:workbookId/charts', WorkbookController.createChart);
router.put('/charts/:id', WorkbookController.updateChart);
router.delete('/charts/:id', WorkbookController.deleteChart);

router.get('/:workbookId/operations', WorkbookController.listOperations);
router.post('/:workbookId/operations', WorkbookController.createOperation);
router.get('/:workbookId/version', WorkbookController.getVersion);

export default router;
