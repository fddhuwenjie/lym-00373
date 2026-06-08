export type CellType = 'text' | 'number' | 'date' | 'formula' | 'error';

export type NumberFormatType = 'general' | 'number' | 'percent' | 'currency' | 'scientific' | 'thousands' | 'custom';

export interface CellFormat {
  decimalPlaces?: number;
  useThousandsSeparator?: boolean;
  dateFormat?: 'YYYY-MM-DD' | 'MM/DD/YYYY';
  isBold?: boolean;
  isItalic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  align?: 'left' | 'center' | 'right';
  numberFormat?: NumberFormatType;
  currencySymbol?: string;
}

export interface Cell {
  id: string;
  type: CellType;
  rawValue: string;
  value: string | number | Date | boolean | null;
  formula?: string;
  format?: CellFormat;
  isError?: boolean;
  errorMessage?: string;
  isCircular?: boolean;
  spillSource?: string;
  isSpillCell?: boolean;
}

export interface Sheet {
  id: string;
  name: string;
  index: number;
  cells: Record<string, Cell>;
  isHidden?: boolean;
  tabColor?: string;
}

export interface CellStyle {
  id: string;
  workbookId: number;
  sheetId: string;
  cellId: string;
  fontColor?: string;
  bgColor?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  numberFormat?: string;
  decimalPlaces?: number;
  useThousandsSeparator?: boolean;
  dateFormat?: 'YYYY-MM-DD' | 'MM/DD/YYYY';
  isBold?: boolean;
  isItalic?: boolean;
  textColor?: string;
  backgroundColor?: string;
  currencySymbol?: string;
}

export type ConditionalFormatRuleType = 
  | 'greaterThan' 
  | 'lessThan' 
  | 'between' 
  | 'equalTo'
  | 'lessThanOrEqualTo'
  | 'greaterThanOrEqualTo'
  | 'notEqualTo'
  | 'containsText'
  | 'notContainsText'
  | 'duplicateValues'
  | 'uniqueValues'
  | 'topN'
  | 'bottomN'
  | 'dataBar'
  | 'twoColorScale'
  | 'threeColorScale';

export interface ConditionalFormatRule {
  type: ConditionalFormatRuleType;
  value1?: string | number;
  value2?: string | number;
  n?: number;
  minColor?: string;
  maxColor?: string;
  midColor?: string;
  barColor?: string;
  params?: Record<string, any>;
}

export interface ConditionalFormatStyle {
  fontColor?: string;
  bgColor?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ConditionalFormat {
  id: string;
  workbookId: number;
  sheetId: string;
  rangeRef: string;
  rule: ConditionalFormatRule;
  style: ConditionalFormatStyle;
  priority: number;
}

export type ChartType = 'bar' | 'line' | 'pie' | 'scatter';

export interface ChartOptions {
  title?: string;
  xAxisTitle?: string;
  yAxisTitle?: string;
  showLegend?: boolean;
  colors?: string[];
}

export interface Chart {
  id: string;
  workbookId: number;
  sheetId: string;
  rangeRef: string;
  type: ChartType;
  options: ChartOptions;
}

export interface Workbook {
  id?: number;
  name: string;
  sheets: Sheet[];
  activeSheetId: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkbookListItem {
  id: number;
  name: string;
  updatedAt: string;
  sheetCount: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export type OperationType = 
  | 'cellUpdate' 
  | 'cellFormatUpdate' 
  | 'sheetCreate' 
  | 'sheetRename' 
  | 'sheetDelete'
  | 'sheetReorder'
  | 'sheetCopy'
  | 'conditionalFormatAdd'
  | 'conditionalFormatRemove'
  | 'conditionalFormatUpdate'
  | 'chartAdd'
  | 'chartRemove'
  | 'chartUpdate';

export interface Operation {
  id?: string;
  type: OperationType;
  timestamp: number;
  lamportTime: number;
  userId: string;
  userName: string;
  sheetId: string;
  payload: Record<string, unknown>;
  reversePayload?: Record<string, unknown>;
}

export interface WsMessage {
  type: 'operation' | 'cursor' | 'sync' | 'hello' | 'welcome';
  payload: Record<string, unknown>;
}

export interface CollaboratorCursor {
  userId: string;
  userName: string;
  sheetId: string;
  cellId: string;
  color: string;
  lastActive: number;
}

export interface WorkbookVersion {
  version: number;
  operations: Operation[];
}

export type FormulaResult = number | string | boolean | null | Cell[] | (number | string | boolean | null)[][];
