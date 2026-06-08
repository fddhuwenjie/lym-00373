export type CellType = 'text' | 'number' | 'date' | 'formula' | 'error';

export interface CellFormat {
  decimalPlaces?: number;
  useThousandsSeparator?: boolean;
  dateFormat?: 'YYYY-MM-DD' | 'MM/DD/YYYY';
  isBold?: boolean;
  isItalic?: boolean;
  textColor?: string;
  backgroundColor?: string;
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
}

export interface Workbook {
  id?: number;
  name: string;
  cells: Record<string, Cell>;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkbookListItem {
  id: number;
  name: string;
  updatedAt: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
