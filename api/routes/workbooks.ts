import { Router } from 'express';
import { WorkbookController } from '../controllers/workbookController';

const router = Router();

router.get('/', WorkbookController.list);
router.get('/:id', WorkbookController.get);
router.post('/', WorkbookController.create);
router.put('/:id', WorkbookController.update);
router.delete('/:id', WorkbookController.remove);
router.get('/:id/export', WorkbookController.exportCSV);

export default router;
