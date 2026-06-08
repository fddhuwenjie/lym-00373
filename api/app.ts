import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import swaggerUi from 'swagger-ui-express'
import workbookRoutes from './routes/workbooks.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'Spreadsheet API',
    version: '1.0.0',
    description: 'REST API for the browser-based spreadsheet application with multi-sheet, formulas, charts, and real-time collaboration'
  },
  servers: [
    { url: '/api', description: 'API server' }
  ],
  tags: [
    { name: 'Workbooks', description: 'Workbook management' },
    { name: 'Sheets', description: 'Sheet operations within workbooks' },
    { name: 'Styles', description: 'Cell styling' },
    { name: 'Conditional Formats', description: 'Conditional formatting rules' },
    { name: 'Charts', description: 'Chart management' },
    { name: 'Operations', description: 'Operation history and sync' },
    { name: 'Export/Import', description: 'CSV and Excel export/import' }
  ],
  paths: {
    '/workbooks': {
      get: {
        tags: ['Workbooks'],
        summary: 'List all workbooks',
        responses: {
          '200': { description: 'List of workbooks' }
        }
      },
      post: {
        tags: ['Workbooks'],
        summary: 'Create a new workbook',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '201': { description: 'Workbook created' }
        }
      }
    },
    '/workbooks/{id}': {
      get: {
        tags: ['Workbooks'],
        summary: 'Get a workbook by ID',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'full', in: 'query', schema: { type: 'boolean' }, description: 'Include styles, formats, and charts' }
        ],
        responses: {
          '200': { description: 'Workbook data' },
          '404': { description: 'Workbook not found' }
        }
      },
      put: {
        tags: ['Workbooks'],
        summary: 'Update a workbook',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Workbook updated' },
          '404': { description: 'Workbook not found' }
        }
      },
      delete: {
        tags: ['Workbooks'],
        summary: 'Delete a workbook',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: {
          '200': { description: 'Workbook deleted' },
          '404': { description: 'Workbook not found' }
        }
      }
    },
    '/workbooks/{id}/export': {
      get: {
        tags: ['Export/Import'],
        summary: 'Export workbook',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['csv', 'xlsx'] }, description: 'Export format' },
          { name: 'sheetId', in: 'query', schema: { type: 'string' }, description: 'Specific sheet to export (CSV only)' }
        ],
        responses: {
          '200': { description: 'File download' }
        }
      }
    },
    '/workbooks/{id}/import': {
      post: {
        tags: ['Export/Import'],
        summary: 'Import Excel file into workbook',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'format', in: 'query', schema: { type: 'string', enum: ['xlsx'] } }
        ],
        requestBody: {
          content: {
            'application/octet-stream': { schema: { type: 'string', format: 'binary' } }
          }
        },
        responses: {
          '200': { description: 'Import successful' }
        }
      }
    },
    '/workbooks/{workbookId}/sheets': {
      get: {
        tags: ['Sheets'],
        summary: 'List all sheets in a workbook',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'List of sheets' } }
      },
      post: {
        tags: ['Sheets'],
        summary: 'Create a new sheet',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '201': { description: 'Sheet created' } }
      }
    },
    '/workbooks/{workbookId}/sheets/{sheetId}': {
      put: {
        tags: ['Sheets'],
        summary: 'Update a sheet (rename, etc.)',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Sheet updated' } }
      },
      delete: {
        tags: ['Sheets'],
        summary: 'Delete a sheet',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Sheet deleted' } }
      }
    },
    '/workbooks/{workbookId}/sheets/{sheetId}/reorder': {
      post: {
        tags: ['Sheets'],
        summary: 'Reorder a sheet',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        requestBody: {
          content: {
            'application/json': {
              schema: { type: 'object', properties: { newIndex: { type: 'number' } } }
            }
          }
        },
        responses: { '200': { description: 'Sheets reordered' } }
      }
    },
    '/workbooks/{workbookId}/sheets/{sheetId}/copy': {
      post: {
        tags: ['Sheets'],
        summary: 'Copy a sheet',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '201': { description: 'Sheet copied' } }
      }
    },
    '/workbooks/{workbookId}/styles': {
      get: {
        tags: ['Styles'],
        summary: 'List cell styles',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'List of cell styles' } }
      }
    },
    '/workbooks/{workbookId}/styles/{sheetId}/{cellId}': {
      put: {
        tags: ['Styles'],
        summary: 'Update cell style',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'cellId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Style updated' } }
      },
      delete: {
        tags: ['Styles'],
        summary: 'Delete cell style',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'cellId', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Style deleted' } }
      }
    },
    '/workbooks/{workbookId}/conditional-formats': {
      get: {
        tags: ['Conditional Formats'],
        summary: 'List conditional formats',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'List of conditional formats' } }
      },
      post: {
        tags: ['Conditional Formats'],
        summary: 'Create a conditional format',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '201': { description: 'Conditional format created' } }
      }
    },
    '/conditional-formats/{id}': {
      put: {
        tags: ['Conditional Formats'],
        summary: 'Update a conditional format',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Conditional format updated' } }
      },
      delete: {
        tags: ['Conditional Formats'],
        summary: 'Delete a conditional format',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Conditional format deleted' } }
      }
    },
    '/workbooks/{workbookId}/charts': {
      get: {
        tags: ['Charts'],
        summary: 'List charts',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'sheetId', in: 'query', schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'List of charts' } }
      },
      post: {
        tags: ['Charts'],
        summary: 'Create a chart',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '201': { description: 'Chart created' } }
      }
    },
    '/charts/{id}': {
      put: {
        tags: ['Charts'],
        summary: 'Update a chart',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Chart updated' } }
      },
      delete: {
        tags: ['Charts'],
        summary: 'Delete a chart',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
        ],
        responses: { '200': { description: 'Chart deleted' } }
      }
    },
    '/workbooks/{workbookId}/operations': {
      get: {
        tags: ['Operations'],
        summary: 'List operations',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'limit', in: 'query', schema: { type: 'integer' } },
          { name: 'sinceVersion', in: 'query', schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'List of operations' } }
      },
      post: {
        tags: ['Operations'],
        summary: 'Record an operation',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '201': { description: 'Operation recorded' } }
      }
    },
    '/workbooks/{workbookId}/version': {
      get: {
        tags: ['Operations'],
        summary: 'Get current version',
        parameters: [
          { name: 'workbookId', in: 'path', required: true, schema: { type: 'integer' } }
        ],
        responses: { '200': { description: 'Current version number' } }
      }
    }
  },
  components: {
    schemas: {
      Workbook: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          name: { type: 'string' },
          sheets: { type: 'array', items: { $ref: '#/components/schemas/Sheet' } },
          activeSheetId: { type: 'string' },
          version: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' }
        }
      },
      Sheet: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          index: { type: 'integer' },
          cells: { type: 'object' },
          isHidden: { type: 'boolean' },
          tabColor: { type: 'string' }
        }
      },
      Cell: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['text', 'number', 'date', 'formula', 'error'] },
          rawValue: { type: 'string' },
          value: { type: ['string', 'number', 'boolean', 'null'] },
          formula: { type: 'string' },
          format: { $ref: '#/components/schemas/CellFormat' },
          isError: { type: 'boolean' },
          errorMessage: { type: 'string' },
          isCircular: { type: 'boolean' }
        }
      },
      CellFormat: {
        type: 'object',
        properties: {
          decimalPlaces: { type: 'integer' },
          useThousandsSeparator: { type: 'boolean' },
          dateFormat: { type: 'string' },
          isBold: { type: 'boolean' },
          isItalic: { type: 'boolean' },
          textColor: { type: 'string' },
          backgroundColor: { type: 'string' },
          align: { type: 'string', enum: ['left', 'center', 'right'] },
          numberFormat: { type: 'string' }
        }
      }
    }
  }
}

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

app.use('/api/workbooks', workbookRoutes)

app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'API not found',
  })
})

export default app
